import type { SupabaseClient } from "@supabase/supabase-js";
import { agentById } from "@/lib/agents";
import { getPerformanceModel, runAgentTurnText } from "@/lib/stream";

export async function executePerformanceStep(params: {
  supabase: SupabaseClient;
  stepRow: {
    id: string;
    run_id: string;
    agent_id: string;
    input: string;
  };
  topic: string;
}): Promise<string> {
  const { supabase, stepRow, topic } = params;
  const agent = agentById(stepRow.agent_id);
  if (!agent) throw new Error("Unknown agent on step");

  const now = new Date().toISOString();
  await supabase
    .from("execution_steps")
    .update({ status: "running", started_at: now })
    .eq("id", stepRow.id);

  await supabase.from("audit_events").insert({
    run_id: stepRow.run_id,
    event_type: "step_started",
    payload: { step_id: stepRow.id, agent_id: stepRow.agent_id },
  });

  try {
    const output = await runAgentTurnText({
      agent,
      topic,
      userMessage: stepRow.input,
      round: 0,
      priorRoundTexts: {},
      model: getPerformanceModel(),
    });

    const doneAt = new Date().toISOString();
    await supabase
      .from("execution_steps")
      .update({
        status: "done",
        output,
        finished_at: doneAt,
      })
      .eq("id", stepRow.id);

    await supabase.from("audit_events").insert({
      run_id: stepRow.run_id,
      event_type: "step_completed",
      payload: { step_id: stepRow.id, agent_id: stepRow.agent_id },
    });
    return output;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("execution_steps")
      .update({
        status: "failed",
        output: msg,
        finished_at: new Date().toISOString(),
      })
      .eq("id", stepRow.id);
    throw e;
  }
}
