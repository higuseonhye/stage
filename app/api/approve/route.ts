import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { executePerformanceStep } from "@/lib/execution";
import {
  buildPerformanceSummaryFromPlanOutputs,
  persistProjectContextAfterPerformance,
} from "@/lib/context";
import { persistDecisionMemoForRun } from "@/lib/persist-decision-memo";
import { userHasWorkspaceAccess } from "@/lib/workspace-access";

export const maxDuration = 300;

const bodySchema = z.object({
  gateId: z.string().uuid(),
  decision: z.enum(["approve", "deny", "edit_approve"]),
  editedPlan: z.string().max(50_000).optional(),
  humanNote: z.string().max(2000).optional().nullable(),
});

type PlanCtx = {
  plan: string;
  analyst: string;
  critic: string;
  strategist: string;
  executor: string;
};

async function assertGateAndOwner(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  gateId: string,
  userId: string,
) {
  const { data: gate, error } = await supabase
    .from("approval_gates")
    .select("id, run_id, action_plan, status")
    .eq("id", gateId)
    .maybeSingle();

  if (error || !gate) return { error: "Gate not found" as const };
  if (gate.status !== "pending") {
    return { error: "Gate already decided" as const };
  }

  const { data: run } = await supabase
    .from("runs")
    .select("id, workspace_id, topic, status, user_message, project_id")
    .eq("id", gate.run_id)
    .maybeSingle();

  if (!run) return { error: "Run not found" as const };

  const canAccess = await userHasWorkspaceAccess(
    supabase,
    userId,
    run.workspace_id,
  );
  if (!canAccess) {
    return { error: "Forbidden" as const };
  }

  return { gate, run };
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten(), { status: 400 });
  }

  const { gateId, decision, editedPlan, humanNote } = parsed.data;

  const ctx = await assertGateAndOwner(supabase, gateId, user.id);
  if ("error" in ctx) {
    const status =
      ctx.error === "Forbidden"
        ? 403
        : ctx.error === "Gate not found" || ctx.error === "Run not found"
          ? 404
          : 409;
    return NextResponse.json({ error: ctx.error }, { status });
  }

  const { gate, run } = ctx;
  const decidedAt = new Date().toISOString();

  if (decision === "deny") {
    await supabase
      .from("approval_gates")
      .update({
        status: "denied",
        human_note: humanNote ?? null,
        decided_by: user.id,
        decided_at: decidedAt,
      })
      .eq("id", gateId);

    await supabase
      .from("runs")
      .update({ status: "completed", completed_at: decidedAt })
      .eq("id", run.id);

    await supabase.from("audit_events").insert({
      run_id: run.id,
      event_type: "gate_denied",
      payload: { gate_id: gateId },
    });

    await persistDecisionMemoForRun(supabase, run.id);

    return NextResponse.json({ ok: true });
  }

  const finalPlan =
    decision === "edit_approve"
      ? (editedPlan ?? gate.action_plan)
      : gate.action_plan;

  if (decision === "edit_approve" && !editedPlan?.trim()) {
    return NextResponse.json(
      { error: "editedPlan required for edit_approve" },
      { status: 400 },
    );
  }

  const gateStatus = decision === "edit_approve" ? "edited" : "approved";

  await supabase
    .from("approval_gates")
    .update({
      status: gateStatus,
      action_plan: finalPlan,
      human_note: humanNote ?? null,
      decided_by: user.id,
      decided_at: decidedAt,
    })
    .eq("id", gateId);

  await supabase.from("audit_events").insert({
    run_id: run.id,
    event_type: "gate_approved",
    payload: { gate_id: gateId, status: gateStatus },
  });

  await supabase
    .from("runs")
    .update({ status: "executing" })
    .eq("id", run.id);

  const acc: PlanCtx = {
    plan: finalPlan,
    analyst: "",
    critic: "",
    strategist: "",
    executor: "",
  };

  const pipeline: {
    step_index: number;
    agent_id: "analyst" | "critic" | "strategist" | "executor";
    buildInput: (c: PlanCtx) => string;
    store: (c: PlanCtx, out: string) => void;
  }[] = [
    {
      step_index: 0,
      agent_id: "analyst",
      buildInput: (c) =>
        `Validate and stress-test this approved plan. Call out gaps, dependencies, and risks briefly.\n\nPlan:\n${c.plan}`,
      store: (c, out) => {
        c.analyst = out;
      },
    },
    {
      step_index: 1,
      agent_id: "critic",
      buildInput: (c) =>
        `Identify risks using the Analyst's output and the original approved plan. Surface failure modes, blind spots, and what could still go wrong.\n\n--- Approved plan ---\n${c.plan}\n\n--- Analyst output ---\n${c.analyst}`,
      store: (c, out) => {
        c.critic = out;
      },
    },
    {
      step_index: 2,
      agent_id: "strategist",
      buildInput: (c) =>
        `Produce a refined, consolidated action plan from the Analyst output, Critic output, and the original approved plan. Be decision-ready and concrete.\n\n--- Original plan ---\n${c.plan}\n\n--- Analyst ---\n${c.analyst}\n\n--- Critic ---\n${c.critic}`,
      store: (c, out) => {
        c.strategist = out;
      },
    },
    {
      step_index: 3,
      agent_id: "executor",
      buildInput: (c) =>
        `Produce a concise operator handoff checklist (bullets) from the Strategist's refined plan below.\n\n--- Strategist refined plan ---\n${c.strategist}`,
      store: (c, out) => {
        c.executor = out;
      },
    },
  ];

  try {
    for (const spec of pipeline) {
      const input = spec.buildInput(acc);
      const { data: row, error } = await supabase
        .from("execution_steps")
        .insert({
          run_id: run.id,
          gate_id: gateId,
          step_index: spec.step_index,
          agent_id: spec.agent_id,
          input,
          status: "queued",
        })
        .select("id, run_id, agent_id, input")
        .single();

      if (error || !row) {
        console.error(error);
        await supabase
          .from("runs")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", run.id);
        return NextResponse.json(
          { error: "Failed to create execution steps" },
          { status: 500 },
        );
      }

      const output = await executePerformanceStep({
        supabase,
        stepRow: row,
        topic: run.topic,
      });
      spec.store(acc, output);
    }

    const completedAt = new Date().toISOString();
    await supabase
      .from("runs")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", run.id);

    await supabase.from("audit_events").insert({
      run_id: run.id,
      event_type: "run_completed",
      payload: { pipeline: "four_step" },
    });

    await persistDecisionMemoForRun(supabase, run.id);

    const perfSummary = buildPerformanceSummaryFromPlanOutputs({
      topic: run.topic,
      userMessage: run.user_message ?? "",
      analyst: acc.analyst,
      critic: acc.critic,
      strategist: acc.strategist,
      executor: acc.executor,
    });
    await persistProjectContextAfterPerformance(supabase, run.id, perfSummary);
  } catch (e) {
    console.error(e);
    await supabase
      .from("runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", run.id);
    return NextResponse.json(
      { error: "Execution failed", partial: true },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
