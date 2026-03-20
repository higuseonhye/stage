import type { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateDecisionMemoMarkdown } from "@/lib/generate-decision-memo";

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export type PersistMemoResult =
  | { ok: true; markdownLength: number }
  | { ok: false; reason: string };

/**
 * After performance completes, generate a decision memo and write `runs.decision_memo_markdown`.
 * Safe to call from approve and from retry-step; failures are logged and audited.
 */
export async function persistDecisionMemoForRun(
  supabase: Supabase,
  runId: string,
): Promise<PersistMemoResult> {
  try {
    const { data: run, error: runErr } = await supabase
      .from("runs")
      .select("topic, user_message")
      .eq("id", runId)
      .maybeSingle();

    if (runErr) {
      return { ok: false, reason: runErr.message };
    }
    if (!run) {
      return { ok: false, reason: "run_not_found" };
    }

    const { data: stepLink } = await supabase
      .from("execution_steps")
      .select("gate_id")
      .eq("run_id", runId)
      .order("step_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    let gateId = stepLink?.gate_id ?? null;
    if (!gateId) {
      const { data: g } = await supabase
        .from("approval_gates")
        .select("id")
        .eq("run_id", runId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      gateId = g?.id ?? null;
    }
    if (!gateId) {
      return { ok: false, reason: "missing_approval_context" };
    }

    const [{ data: msgs }, { data: stepsRows }, { data: gateRow }] =
      await Promise.all([
        supabase
          .from("agent_messages")
          .select("agent_id, agent_name, content, round, created_at")
          .eq("run_id", runId)
          .order("round", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("execution_steps")
          .select("step_index, agent_id, output")
          .eq("run_id", runId)
          .order("step_index", { ascending: true }),
        supabase
          .from("approval_gates")
          .select("action_plan, human_note, status")
          .eq("id", gateId)
          .maybeSingle(),
      ]);

    const cueOutcome =
      gateRow?.status === "denied" ? ("denied" as const) : ("approved" as const);

    const markdown = await generateDecisionMemoMarkdown({
      topic: run.topic,
      userMessage: run.user_message ?? "",
      messages: msgs ?? [],
      approvedPlan: gateRow?.action_plan ?? "",
      directorNote: gateRow?.human_note ?? null,
      steps: stepsRows ?? [],
      cueOutcome,
    });

    const { error: upErr } = await supabase
      .from("runs")
      .update({ decision_memo_markdown: markdown })
      .eq("id", runId);

    if (upErr) {
      console.error(upErr);
      await supabase.from("audit_events").insert({
        run_id: runId,
        event_type: "decision_memo_failed",
        payload: { message: upErr.message, phase: "update" },
      });
      return { ok: false, reason: upErr.message };
    }

    await supabase.from("audit_events").insert({
      run_id: runId,
      event_type: "decision_memo_generated",
      payload: { length: markdown.length },
    });
    return { ok: true, markdownLength: markdown.length };
  } catch (memoErr) {
    console.error(memoErr);
    const message =
      memoErr instanceof Error ? memoErr.message : String(memoErr);
    await supabase.from("audit_events").insert({
      run_id: runId,
      event_type: "decision_memo_failed",
      payload: { message },
    });
    return { ok: false, reason: message };
  }
}
