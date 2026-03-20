import { streamText, type LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { AgentDefinition } from "@/lib/agents";

export function getLanguageModel(): LanguageModel {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const anthropic = createAnthropic({ apiKey: anthropicKey });
    const id =
      process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
    return anthropic(id);
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error(
      "Set ANTHROPIC_API_KEY (primary) or OPENAI_API_KEY (fallback).",
    );
  }
  const openai = createOpenAI({ apiKey: openaiKey });
  return openai(process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini");
}

export function getOpenAIFallbackModel(): LanguageModel | null {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;
  const openai = createOpenAI({ apiKey: openaiKey });
  return openai(process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini");
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
  const model = params.model ?? getLanguageModel();
  return streamText({
    model,
    system: params.agent.systemPrompt,
    prompt,
    maxOutputTokens: 2048,
  });
}

export type AgentTurnParams = Omit<
  Parameters<typeof streamAgentTurn>[0],
  "model"
> & { model?: LanguageModel };

export async function runAgentTurnText(params: AgentTurnParams): Promise<string> {
  let text = "";
  const attempt = async (useFallback: boolean) => {
    const model = useFallback
      ? getOpenAIFallbackModel() ?? getLanguageModel()
      : (params.model ?? getLanguageModel());
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
