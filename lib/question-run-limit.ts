import type { SupabaseClient } from "@supabase/supabase-js";

/** Max runs for the same normalized question (topic + brief) per workspace */
export const MAX_RUNS_PER_QUESTION = 3;

export function normalizeQuestionParts(topic: string, userMessage: string) {
  const n = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return { topic: n(topic), brief: n(userMessage ?? "") };
}

export function questionRowMatches(
  row: { topic: string; user_message: string },
  norm: ReturnType<typeof normalizeQuestionParts>,
): boolean {
  const p = normalizeQuestionParts(row.topic, row.user_message);
  return p.topic === norm.topic && p.brief === norm.brief;
}

export async function countRunsForQuestion(
  supabase: SupabaseClient,
  userId: string,
  topic: string,
  userMessage: string,
): Promise<number> {
  const norm = normalizeQuestionParts(topic, userMessage);
  const { data: workspaces, error: wErr } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId);
  if (wErr) throw wErr;
  const ids = workspaces?.map((w) => w.id) ?? [];
  if (ids.length === 0) return 0;

  const { data: runs, error } = await supabase
    .from("runs")
    .select("topic, user_message")
    .in("workspace_id", ids);
  if (error) throw error;
  return runs?.filter((r) => questionRowMatches(r, norm)).length ?? 0;
}
