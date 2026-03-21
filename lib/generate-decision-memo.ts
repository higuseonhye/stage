import { agentById, AGENTS } from "@/lib/agents";
import type { AgentMessageLike } from "@/lib/run-messages";
import { latestContentByAgent } from "@/lib/run-messages";
import { generateTextWithModelFallback } from "@/lib/model-fallback";

export type ExecutionStepSlice = {
  step_index: number;
  agent_id: string;
  output: string;
};

function discussionBlock(messages: AgentMessageLike[]): string {
  const latest = latestContentByAgent(messages);
  return AGENTS.map((a) => {
    const body = (latest[a.id] ?? "").trim();
    const clipped = body.length > 4500 ? `${body.slice(0, 4500)}…` : body;
    return `### ${a.name}\n${clipped || "(no text)"}`;
  }).join("\n\n");
}

function performanceBlock(steps: ExecutionStepSlice[]): string {
  const sorted = [...steps].sort((a, b) => a.step_index - b.step_index);
  return sorted
    .map((s) => {
      const agent = agentById(s.agent_id);
      const label = agent?.name ?? s.agent_id;
      const out = (s.output ?? "").trim();
      const clipped = out.length > 6000 ? `${out.slice(0, 6000)}…` : out;
      return `### Step ${s.step_index + 1} — ${label}\n${clipped || "—"}`;
    })
    .join("\n\n");
}

/**
 * Produce a director-ready Markdown memo from run artifacts (uses PERFORMANCE_MODEL).
 */
export async function generateDecisionMemoMarkdown(params: {
  topic: string;
  userMessage: string;
  messages: AgentMessageLike[];
  approvedPlan: string;
  directorNote: string | null;
  steps: ExecutionStepSlice[];
  /** Default: approved cue + performance. `denied` = proposed plan was declined; no pipeline ran. */
  cueOutcome?: "approved" | "denied";
}): Promise<string> {
  const cueOutcome = params.cueOutcome ?? "approved";
  const discussion = discussionBlock(params.messages);
  const performance = performanceBlock(params.steps);

  const systemApproved = `You write a single Markdown document: a one-page "decision memo" for a director who ran a four-agent AI panel (Stage), approved a cue, and completed a four-step execution pipeline.

Rules:
- Output Markdown only (no fenced code block wrapping the whole doc).
- Start with H1: include the run topic in the title.
- Include sections aligned with: what we are deciding (one clear sentence), context & constraints, key options or paths (use a GFM table if useful), what the panel concluded (map Analyst / Critic / Strategist / Executor from the discussion excerpt), risks if we choose wrong (short table or bullets), a concrete decision block (who should do what next / open choices), next 7 days and 90 days, and a minimal sign-off table (Name | Role | Date) with placeholders.
- Be faithful to the supplied discussion and performance text; do not invent facts. You may synthesize and tighten wording.
- Keep it scannable: bullets, short paragraphs, under ~2000 words.`;

  const systemDenied = `You write a single Markdown document: a one-page "decision memo" for a director who ran a four-agent AI panel (Stage) and **declined** the proposed cue. No performance / execution pipeline was run.

Rules:
- Output Markdown only (no fenced code block wrapping the whole doc).
- Start with H1: include the run topic in the title.
- State early and clearly that the proposed plan was **not approved** and execution did not run.
- Focus on: what was on the table, what the panel concluded in discussion (Analyst / Critic / Strategist / Executor from the excerpt), why not proceeding (use director note if present; do not invent reasons), risks of the proposed path, and concrete next steps / reopen criteria.
- If there are no performance outputs, say so briefly — do not fabricate execution results.
- Be faithful to the supplied text; do not invent facts. Keep it scannable, under ~2000 words.`;

  const planHeading =
    cueOutcome === "denied"
      ? "## Proposed action plan (director did not approve — not executed)"
      : "## Approved action plan (as cued)";

  const performanceSection =
    cueOutcome === "denied" && !params.steps.length
      ? "## Performance pipeline outputs\n_(None — cue was denied before execution.)_"
      : `## Performance pipeline outputs\n${performance}`;

  const { text } = await generateTextWithModelFallback(
    {
      maxOutputTokens: 12_288,
      system: cueOutcome === "denied" ? systemDenied : systemApproved,
      prompt: `## Topic
${params.topic}

## Director brief
${params.userMessage.trim() || "(none)"}

## Discussion (final round per actor)
${discussion}

${planHeading}
${params.approvedPlan.trim()}

## Director note at cue
${params.directorNote?.trim() || "(none)"}

${performanceSection}

Write the full decision memo now.`,
    },
    "performance",
  );

  return text.trim();
}
