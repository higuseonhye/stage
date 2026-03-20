import { streamText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { AgentDefinition } from "@/lib/agents";

function requireAnthropicOrFallback(): {
  anthropic: ReturnType<typeof createAnthropic> | null;
  openai: ReturnType<typeof createOpenAI> | null;
} {
  const ak = process.env.ANTHROPIC_API_KEY;
  const ok = process.env.OPENAI_API_KEY;
  return {
    anthropic: ak ? createAnthropic({ apiKey: ak }) : null,
    openai: ok ? createOpenAI({ apiKey: ok }) : null,
  };
}

/** Discussion + adaptive convergence (default: claude-haiku-4-5) */
export function getDiscussionModel(): LanguageModel {
  const { anthropic, openai } = requireAnthropicOrFallback();
  const id =
    process.env.DISCUSSION_MODEL?.trim() || "claude-haiku-4-5";
  if (anthropic) return anthropic(id);
  if (openai) {
    return openai(process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini");
  }
  throw new Error(
    "Set ANTHROPIC_API_KEY for discussion models, or OPENAI_API_KEY as fallback.",
  );
}

/** Performance pipeline steps (default: claude-sonnet-4-6) */
export function getPerformanceModel(): LanguageModel {
  const { anthropic, openai } = requireAnthropicOrFallback();
  const id =
    process.env.PERFORMANCE_MODEL?.trim() || "claude-sonnet-4-6";
  if (anthropic) return anthropic(id);
  if (openai) {
    return openai(process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini");
  }
  throw new Error(
    "Set ANTHROPIC_API_KEY for performance models, or OPENAI_API_KEY as fallback.",
  );
}

/** @deprecated Prefer getDiscussionModel / getPerformanceModel */
export function getLanguageModel(): LanguageModel {
  return getDiscussionModel();
}

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
}) {
  const prompt = buildUserPrompt({
    topic: params.topic,
    userMessage: params.userMessage,
    round: params.round,
    priorRoundTexts: params.priorRoundTexts,
  });
  const model = params.model ?? getDiscussionModel();
  return streamText({
    model,
    system: params.agent.systemPrompt,
    prompt,
    maxOutputTokens: 16_384,
  });
}

export type AgentTurnParams = Omit<
  Parameters<typeof streamAgentTurn>[0],
  "model"
> & { model?: LanguageModel };

export async function runAgentTurnText(params: AgentTurnParams): Promise<string> {
  let text = "";
  const attempt = async (useFallback: boolean) => {
    const primary = params.model ?? getDiscussionModel();
    const model = useFallback
      ? getOpenAIFallbackModel() ?? primary
      : primary;
    const result = streamAgentTurn({ ...params, model });
    for await (const part of result.textStream) {
      text += part;
    }
  };
  try {
    await attempt(false);
  } catch {
    if (!getOpenAIFallbackModel()) {
      throw new Error("Model stream failed");
    }
    text = "";
    await attempt(true);
  }
  return text;
}
