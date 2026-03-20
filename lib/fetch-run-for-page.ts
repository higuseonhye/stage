import type { SupabaseClient } from "@supabase/supabase-js";

/** Columns from initial migration — always safe to select */
const RUN_BASE_FIELDS =
  "id, topic, user_message, status, created_at, completed_at, workspace_id" as const;

export type RunPageRow = {
  id: string;
  topic: string;
  user_message: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  workspace_id: string;
  decision_memo_markdown: string | null;
};

/**
 * Load a run for /runs/[id]. Avoids 404 when `decision_memo_markdown` exists in
 * code but the DB migration has not been applied yet.
 */
export async function fetchRunForPage(
  supabase: SupabaseClient,
  runId: string,
): Promise<{ data: RunPageRow | null; error: { message: string } | null }> {
  const { data: run, error } = await supabase
    .from("runs")
    .select(RUN_BASE_FIELDS)
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    return { data: null, error: { message: error.message } };
  }
  if (!run) {
    return { data: null, error: null };
  }

  let decision_memo_markdown: string | null = null;
  const memoRes = await supabase
    .from("runs")
    .select("decision_memo_markdown")
    .eq("id", runId)
    .maybeSingle();

  if (!memoRes.error && memoRes.data) {
    const row = memoRes.data as { decision_memo_markdown?: string | null };
    decision_memo_markdown = row.decision_memo_markdown ?? null;
  }

  return {
    data: { ...run, decision_memo_markdown },
    error: null,
  };
}
