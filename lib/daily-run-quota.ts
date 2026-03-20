import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Max runs per user per UTC day (all questions combined).
 * Default 20: enough for many distinct topics while capping API spend if someone
 * spams unique wordings. Override with MAX_RUNS_PER_DAY in .env.
 */
function readMaxRunsPerDay(): number {
  const raw = process.env.MAX_RUNS_PER_DAY?.trim();
  const n = raw ? parseInt(raw, 10) : 20;
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(500, n);
}

export const MAX_RUNS_PER_DAY = readMaxRunsPerDay();

/** ISO timestamp (UTC) for the start of the current UTC day */
export function utcDayStartIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0)).toISOString();
}

/** ISO timestamp for the next UTC midnight (reset boundary) */
export function utcNextMidnightIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0)).toISOString();
}

export async function countRunsCreatedSinceUtc(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { data: workspaces, error: wErr } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId);
  if (wErr) throw wErr;
  const ids = workspaces?.map((w) => w.id) ?? [];
  if (ids.length === 0) return 0;

  const { count, error } = await supabase
    .from("runs")
    .select("id", { count: "exact", head: true })
    .in("workspace_id", ids)
    .gte("created_at", sinceIso);

  if (error) throw error;
  return count ?? 0;
}
