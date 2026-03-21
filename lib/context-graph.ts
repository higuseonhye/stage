import { z } from "zod";

/**
 * Context Graph — AI-filled structured situation (not a user form).
 * Drives inference → validation → analysis.
 */
export const contextGraphSchema = z.object({
  idea: z.string().describe("What the product or initiative is"),
  target: z.string().describe("Who it is for / ICP"),
  stage: z.enum(["idea", "mvp", "growth"]),
  market: z.string().describe("Market or problem space"),
  competition: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe("Competitors or substitutes"),
  advantage: z.string().describe("Differentiation or edge"),
  goal: z.string().describe("Near-term outcome to aim for"),
});

export type ContextGraph = z.infer<typeof contextGraphSchema>;

export function formatContextGraphForBrief(graph: ContextGraph): string {
  return [
    "### Context graph (AI-inferred, user validated)",
    "",
    `- **Idea:** ${graph.idea}`,
    `- **Target / customer:** ${graph.target}`,
    `- **Stage:** ${graph.stage}`,
    `- **Market:** ${graph.market}`,
    `- **Competition:** ${graph.competition.join(" · ")}`,
    `- **Advantage:** ${graph.advantage}`,
    `- **Goal:** ${graph.goal}`,
  ].join("\n");
}

/** Seed `projects.context_snapshot` from a validated graph (before performance merges). */
export function initialSnapshotFromGraph(graph: ContextGraph): Record<string, unknown> {
  return {
    ...graph,
    _meta: {
      source: "context_layer",
      seeded_at: new Date().toISOString(),
    },
  };
}

/** True if we can safely seed from a new graph (no structured idea yet). */
export function isSnapshotSeedableEmpty(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return true;
  }
  const idea = (snapshot as Record<string, unknown>).idea;
  return typeof idea !== "string" || idea.trim() === "";
}

/** Short lines for dashboard / lists (works for layer-seeded or flat snapshots). */
export function dashboardSummaryFromSnapshot(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return [];
  }
  const o = snapshot as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof o.idea === "string" && o.idea.trim()) {
    const t = o.idea.trim();
    lines.push(t.length > 140 ? `${t.slice(0, 140)}…` : t);
  }
  if (typeof o.stage === "string" && o.stage.trim()) {
    lines.push(`Stage: ${o.stage}`);
  }
  if (typeof o.goal === "string" && o.goal.trim()) {
    const t = o.goal.trim();
    lines.push(`Goal: ${t.length > 120 ? `${t.slice(0, 120)}…` : t}`);
  }
  return lines.slice(0, 4);
}
