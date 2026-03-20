import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { executePerformanceStep } from "@/lib/execution";

export const maxDuration = 300;

const bodySchema = z.object({
  gateId: z.string().uuid(),
  decision: z.enum(["approve", "deny", "edit_approve"]),
  editedPlan: z.string().max(50_000).optional(),
  humanNote: z.string().max(2000).optional().nullable(),
});

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
    .select("id, workspace_id, topic, status")
    .eq("id", gate.run_id)
    .maybeSingle();

  if (!run) return { error: "Run not found" as const };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", run.workspace_id)
    .maybeSingle();

  if (!workspace || workspace.owner_id !== userId) {
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

  const steps = [
    {
      step_index: 0,
      agent_id: "analyst",
      input: `Validate and stress-test this approved plan. Call out gaps, dependencies, and risks briefly.\n\nPlan:\n${finalPlan}`,
    },
    {
      step_index: 1,
      agent_id: "executor",
      input: `Produce a concise operator handoff checklist (bullets) for executing the plan.\n\nPlan:\n${finalPlan}`,
    },
  ];

  const inserted: { id: string; run_id: string; agent_id: string; input: string }[] =
    [];

  for (const s of steps) {
    const { data: row, error } = await supabase
      .from("execution_steps")
      .insert({
        run_id: run.id,
        gate_id: gateId,
        step_index: s.step_index,
        agent_id: s.agent_id,
        input: s.input,
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
    inserted.push(row);
  }

  try {
    for (const row of inserted) {
      await executePerformanceStep({
        supabase,
        stepRow: row,
        topic: run.topic,
      });
    }

    const completedAt = new Date().toISOString();
    await supabase
      .from("runs")
      .update({ status: "completed", completed_at: completedAt })
      .eq("id", run.id);

    await supabase.from("audit_events").insert({
      run_id: run.id,
      event_type: "run_completed",
      payload: {},
    });
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
