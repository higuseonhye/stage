import { streamText, type LanguageModel } from "ai";

/** Result of `streamText` — used to collect text from `fullStream` + fallbacks. */
type StreamTextInvocationResult = ReturnType<typeof streamText>;

/**
 * Collect assistant text from a streamText result. Prefer `fullStream` (text-delta)
 * so we do not miss content when `textStream` is empty for some providers.
 * If still empty, use aggregated `text` / `reasoningText`.
 */
export async function collectStreamedAssistantText(
  result: StreamTextInvocationResult,
  onTextDelta?: (chunk: string) => void,
): Promise<string> {
  let full = "";
  for await (const part of result.fullStream) {
    if (part.type === "error") {
      throw part.error instanceof Error
        ? part.error
        : new Error(String(part.error));
    }
    if (part.type === "text-delta" && part.text.length > 0) {
      full += part.text;
      onTextDelta?.(part.text);
    }
  }
  if (!full.trim()) {
    try {
      full = await result.text;
    } catch {
      /* final step may fail if stream errored */
    }
  }
  if (!full.trim()) {
    try {
      const r = await result.reasoningText;
      if (r?.trim()) full = r;
    } catch {
      /* ignore */
    }
  }
  return full;
}
import { createOpenAI } from "@ai-sdk/openai";
import { AGENTS, type AgentDefinition } from "@/lib/agents";
import {
  getDiscussionModelsOrdered,
  getPerformanceModelsOrdered,
} from "@/lib/model-fallback";

function requireAnyModel(
  kind: "discussion" | "performance",
): LanguageModel {
  const models =
    kind === "discussion"
      ? getDiscussionModelsOrdered()
      : getPerformanceModelsOrdered();
  if (!models.length) {
    throw new Error(
      "No AI providers configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY.",
    );
  }
  return models[0];
}

/** Discussion + adaptive convergence (default: claude-haiku-4-5); falls back via model chain at call sites. */
export function getDiscussionModel(): LanguageModel {
  return requireAnyModel("discussion");
}

/** Performance pipeline (default: claude-sonnet-4-6); falls back via model chain at call sites. */
export function getPerformanceModel(): LanguageModel {
  return requireAnyModel("performance");
}

/** @deprecated Prefer getDiscussionModel / getPerformanceModel */
export function getLanguageModel(): LanguageModel {
  return getDiscussionModel();
}

/** OpenAI only — used when caller wants explicit OpenAI (legacy). */
export function getOpenAIFallbackModel(): LanguageModel | null {
  const ok = process.env.OPENAI_API_KEY;
  if (!ok) return null;
  return createOpenAI({ apiKey: ok })(
    process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  );
}

export function buildUserPrompt(params: {
  topic: string;
  userMessage: string;
  round: number;
  priorRoundTexts: Record<string, string>;
}): string {
  const { topic, userMessage, round, priorRoundTexts } = params;
  const header = `Topic:\n${topic}\n\nDirector's brief:\n${userMessage || "(none)"}`;
  if (round === 0) {
    return `${header}\n\nGive your contribution for this round. Stay in character.`;
  }
  const others = Object.entries(priorRoundTexts)
    .map(([id, text]) => `### ${id}\n${text}`)
    .join("\n\n");
  return `${header}\n\n--- Other actors (previous round) ---\n${others}\n\nRefine your position for round ${round}. Build on or challenge others where useful.`;
}

export function streamAgentTurn(params: {
  agent: AgentDefinition;
  topic: string;
  userMessage: string;
  round: number;
  priorRoundTexts: Record<string, string>;
  model?: LanguageModel;
  /** Prepended to the agent system prompt (e.g. accumulated project context). */
  systemPrefix?: string;
}) {
  const prompt = buildUserPrompt({
    topic: params.topic,
    userMessage: params.userMessage,
    round: params.round,
    priorRoundTexts: params.priorRoundTexts,
  });
  const model = params.model ?? getDiscussionModel();
  const system = params.systemPrefix?.trim()
    ? `${params.systemPrefix.trim()}\n\n${params.agent.systemPrompt}`
    : params.agent.systemPrompt;
  return streamText({
    model,
    system,
    prompt,
    maxOutputTokens: 16_384,
  });
}

export type AgentTurnParams = Omit<
  Parameters<typeof streamAgentTurn>[0],
  "model"
> & { model?: LanguageModel };

export async function runAgentTurnText(
  params: AgentTurnParams & {
    tier?: "discussion" | "performance";
  },
): Promise<string> {
  const tier = params.tier ?? "discussion";
  const models =
    tier === "performance"
      ? getPerformanceModelsOrdered()
      : getDiscussionModelsOrdered();
  if (!models.length) {
    throw new Error(
      "No AI providers configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY.",
    );
  }
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      const result = streamAgentTurn({
        ...params,
        model: models[i],
      });
      const text = await collectStreamedAssistantText(result);
      if (!text.trim()) {
        throw new Error("Empty model response");
      }
      return text;
    } catch (e) {
      lastErr = e;
      if (i < models.length - 1) {
        console.warn(
          `[ai] runAgentTurnText ${tier} fallback ${i + 1}→${i + 2}/${models.length}:`,
          e instanceof Error ? e.message : e,
        );
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

// --- Structured multi-round debate (Stage panel) --------------------------------

export type DebatePhase = "position" | "attack" | "defense";

function formatAgentBlocks(
  idToText: Record<string, string>,
  excludeId?: string,
): string {
  return AGENTS.filter((a) => a.id !== excludeId)
    .map(
      (a) =>
        `### ${a.name} (${a.id})\n${(idToText[a.id] ?? "").trim() || "(empty)"}`,
    )
    .join("\n\n");
}

function formatAllAgentBlocks(idToText: Record<string, string>): string {
  return AGENTS.map(
    (a) =>
      `### ${a.name} (${a.id})\n${(idToText[a.id] ?? "").trim() || "(empty)"}`,
  ).join("\n\n");
}

export function buildDebateUserPrompt(params: {
  topic: string;
  userMessage: string;
  phase: DebatePhase;
  agentId: string;
  round1ByAgent: Record<string, string>;
  round2ByAgent?: Record<string, string>;
}): string {
  const { topic, userMessage, phase, agentId, round1ByAgent, round2ByAgent } =
    params;
  const header = `Topic:\n${topic}\n\nDirector's brief:\n${userMessage || "(none)"}`;
  if (phase === "position") {
    return `${header}\n\n## Round 1 — Position\nState your initial position on this topic. Stay in character. Be specific and substantive.`;
  }
  if (phase === "attack") {
    const others = formatAgentBlocks(round1ByAgent, agentId);
    return `${header}\n\n## Round 1 — what other actors stated\n${others}\n\n## Round 2 — Attack\nCritically analyze weaknesses, gaps, blind spots, and risks in **each other actor's** Round 1 position above (not your own). Be direct and specific.`;
  }
  const r1 = (round1ByAgent[agentId] ?? "").trim() || "(empty)";
  const r2All = formatAllAgentBlocks(round2ByAgent ?? {});
  return `${header}\n\n## Your Round 1 position (yours)\n${r1}\n\n## Round 2 — full panel (attacks)\n${r2All}\n\n## Round 3 — Defend\nRespond to attacks on your position. Address objections, concede where appropriate, and strengthen or refine your stance.`;
}

export function streamDebateAgentTurn(params: {
  agent: AgentDefinition;
  topic: string;
  userMessage: string;
  phase: DebatePhase;
  round1ByAgent: Record<string, string>;
  round2ByAgent?: Record<string, string>;
  model?: LanguageModel;
  systemPrefix?: string;
}) {
  const prompt = buildDebateUserPrompt({
    topic: params.topic,
    userMessage: params.userMessage,
    phase: params.phase,
    agentId: params.agent.id,
    round1ByAgent: params.round1ByAgent,
    round2ByAgent: params.round2ByAgent,
  });
  const model = params.model ?? getDiscussionModel();
  const system = params.systemPrefix?.trim()
    ? `${params.systemPrefix.trim()}\n\n${params.agent.systemPrompt}`
    : params.agent.systemPrompt;
  return streamText({
    model,
    system,
    prompt,
    maxOutputTokens: 16_384,
  });
}

const SYNTHESIS_SYSTEM = `You are a neutral facilitator summarizing a staged debate for a human Director (decision-maker).

Rules:
- Do not recommend a decision or tell the Director what to do.
- Do not take sides or declare a winner.
- Cover: main positions, key clashes, unresolved tensions, and what would need to change for each actor to move.
- Use clear Markdown headings and bullets. Stay concise.`;

function buildSynthesisUserPrompt(params: {
  topic: string;
  userMessage: string;
  round1: Record<string, string>;
  round2: Record<string, string>;
  round3: Record<string, string>;
}): string {
  const block = (label: string, map: Record<string, string>) =>
    `## ${label}\n${formatAllAgentBlocks(map)}`;
  return `Topic:\n${params.topic}\n\nDirector's brief:\n${params.userMessage || "(none)"}

${block("Round 1 — positions", params.round1)}

${block("Round 2 — attacks", params.round2)}

${block("Round 3 — defenses", params.round3)}

Write the Synthesis: a neutral summary for the Director to read before giving cue.`;
}

export function streamSynthesis(params: {
  topic: string;
  userMessage: string;
  round1: Record<string, string>;
  round2: Record<string, string>;
  round3: Record<string, string>;
  model?: LanguageModel;
  systemPrefix?: string;
}) {
  const prompt = buildSynthesisUserPrompt(params);
  const model = params.model ?? getDiscussionModel();
  const system = params.systemPrefix?.trim()
    ? `${params.systemPrefix.trim()}\n\n${SYNTHESIS_SYSTEM}`
    : SYNTHESIS_SYSTEM;
  return streamText({
    model,
    system,
    prompt,
    maxOutputTokens: 16_384,
  });
}
