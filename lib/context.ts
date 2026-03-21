/**
 * Context Reconstruction Engine (Stage)
 *
 * - `updateContextSnapshot` — LLM merges a new run’s performance summary into
 *   `projects.context_snapshot` (JSON).
 * - `persistProjectContextAfterPerformance` — called from `/api/approve` and
 *   retry-step when a pipeline finishes; writes back to Supabase.
 * - Discussion injection — `app/api/discuss` loads `context_snapshot` and passes
 *   it as `systemPrefix` in `lib/stream.ts` → `streamAgentTurn` (agents see
 *   accumulated project context before their role prompts).
 *
 * Not a separate package: it lives inside Stage and depends on `runs`,
 * `projects`, discuss, and approve (see docs/context-reconstruction-engine.md).
 */
import type { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateTextWithModelFallback } from "@/lib/model-fallback";

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "");
    t = t.replace(/\s*```$/, "");
  }
  return t.trim();
}

/**
 * Merge this run's outcome text into the project JSON snapshot (uses PERFORMANCE_MODEL).
 */
export async function updateContextSnapshot({
  currentSnapshot,
  runSummary,
}: {
  currentSnapshot: Record<string, unknown>;
  runSummary: string;
}): Promise<Record<string, unknown>> {
  const { text } = await generateTextWithModelFallback(
    {
      maxOutputTokens: 2000,
      system: `You are a context manager for an AI agent system. Merge new information into a JSON object. Output valid JSON only — no preamble, no markdown fences.`,
      prompt: `Existing context snapshot:
${JSON.stringify(currentSnapshot, null, 2)}

New information from this run:
${runSummary}

Update the context snapshot by merging in any new information.
Preserve all existing fields. Add new fields only when clearly supported by the run summary.
Respond with a single JSON object only.`,
    },
    "performance",
  );
  try {
    return JSON.parse(stripJsonFences(text)) as Record<string, unknown>;
  } catch (e) {
    console.error("updateContextSnapshot parse failed", e, text);
    return {
      ...currentSnapshot,
      _merge_parse_error: true,
      _raw_excerpt: text.slice(0, 800),
    };
  }
}

/**
 * After performance completes, fold pipeline outputs into the linked project's `context_snapshot`.
 */
export async function persistProjectContextAfterPerformance(
  supabase: Supabase,
  runId: string,
  runSummary: string,
): Promise<void> {
  if (!runSummary.trim()) return;

  const { data: run } = await supabase
    .from("runs")
    .select("project_id")
    .eq("id", runId)
    .maybeSingle();

  const projectId = run?.project_id;
  if (!projectId) return;

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("context_snapshot")
    .eq("id", projectId)
    .maybeSingle();

  if (pErr || !project) return;

  const current =
    project.context_snapshot &&
    typeof project.context_snapshot === "object" &&
    !Array.isArray(project.context_snapshot)
      ? (project.context_snapshot as Record<string, unknown>)
      : {};

  const updated = await updateContextSnapshot({
    currentSnapshot: current,
    runSummary,
  });

  const { error: upErr } = await supabase
    .from("projects")
    .update({ context_snapshot: updated })
    .eq("id", projectId);

  if (upErr) {
    console.error(upErr);
    return;
  }

  await supabase.from("audit_events").insert({
    run_id: runId,
    event_type: "project_context_updated",
    payload: { project_id: projectId },
  });
}

/** Build summary from in-memory pipeline outputs (approve route). */
export function buildPerformanceSummaryFromPlanOutputs(params: {
  topic: string;
  userMessage: string;
  analyst: string;
  critic: string;
  strategist: string;
  executor: string;
}): string {
  return [
    `Run topic: ${params.topic}`,
    `Director brief: ${params.userMessage || "(none)"}`,
    `--- Analyst ---\n${params.analyst}`,
    `--- Critic ---\n${params.critic}`,
    `--- Strategist ---\n${params.strategist}`,
    `--- Executor (handoff) ---\n${params.executor}`,
  ].join("\n\n");
}

/** Build a text blob for context merge from persisted execution step rows. */
export function buildPerformanceSummaryFromStepRows(params: {
  topic: string;
  userMessage: string;
  steps: { step_index: number; agent_id: string; output: string | null }[];
}): string {
  const sorted = [...params.steps].sort((a, b) => a.step_index - b.step_index);
  const parts = [
    `Run topic: ${params.topic}`,
    `Director brief: ${params.userMessage || "(none)"}`,
    ...sorted.map(
      (s) =>
        `--- ${s.agent_id} (step ${s.step_index + 1}) ---\n${(s.output ?? "").trim() || "—"}`,
    ),
  ];
  return parts.join("\n\n");
}
