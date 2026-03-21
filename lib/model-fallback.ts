import {
  generateObject,
  generateText,
  type FlexibleSchema,
  type LanguageModel,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Product default: full provider cascade for availability —
 * Anthropic → OpenAI → Groq (free tier) → Google Gemini (free tier).
 *
 * On any failure (including credit exhaustion, quota, rate limits), callers
 * try the next configured provider so streaming/discussion UX does not stop
 * after the first error. Providers without API keys are skipped.
 */

export function shouldRetryWithFallbackProvider(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (
    msg.includes("credit balance") ||
    msg.includes("too low") ||
    msg.includes("billing") ||
    msg.includes("insufficient") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("overloaded") ||
    msg.includes("capacity")
  ) {
    return true;
  }
  const any = error as { statusCode?: number; status?: number; cause?: { status?: number } };
  const code = any?.statusCode ?? any?.status ?? any?.cause?.status;
  if (code === 402 || code === 429) return true;
  return false;
}

function anthropicClient() {
  const ak = process.env.ANTHROPIC_API_KEY;
  return ak ? createAnthropic({ apiKey: ak }) : null;
}

function openaiClient() {
  const ok = process.env.OPENAI_API_KEY;
  return ok ? createOpenAI({ apiKey: ok }) : null;
}

function groqModel(): LanguageModel | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const groq = createGroq({ apiKey: key });
  const id = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
  return groq(id);
}

function googleModel(): LanguageModel | null {
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const provider = createGoogleGenerativeAI({ apiKey: key });
  const id =
    process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() || "gemini-2.0-flash";
  return provider(id);
}

export function getDiscussionModelsOrdered(): LanguageModel[] {
  const out: LanguageModel[] = [];
  const anthropic = anthropicClient();
  const openai = openaiClient();
  const id =
    process.env.DISCUSSION_MODEL?.trim() || "claude-haiku-4-5";
  if (anthropic) out.push(anthropic(id));
  if (openai) {
    out.push(
      openai(
        process.env.OPENAI_DISCUSSION_MODEL?.trim() ||
          process.env.OPENAI_MODEL?.trim() ||
          "gpt-4o-mini",
      ),
    );
  }
  const g = groqModel();
  if (g) out.push(g);
  const gem = googleModel();
  if (gem) out.push(gem);
  return out;
}

export function getPerformanceModelsOrdered(): LanguageModel[] {
  const out: LanguageModel[] = [];
  const anthropic = anthropicClient();
  const openai = openaiClient();
  const id =
    process.env.PERFORMANCE_MODEL?.trim() || "claude-sonnet-4-6";
  if (anthropic) out.push(anthropic(id));
  if (openai) {
    out.push(
      openai(
        process.env.OPENAI_PERFORMANCE_MODEL?.trim() ||
          process.env.OPENAI_MODEL?.trim() ||
          "gpt-4o-mini",
      ),
    );
  }
  const g = groqModel();
  if (g) out.push(g);
  const gem = googleModel();
  if (gem) out.push(gem);
  return out;
}

type GenerateTextParams = Omit<Parameters<typeof generateText>[0], "model">;
/** `generateObject` is generic; `Parameters<>` loses `schema` — require it explicitly for object output. */
type GenerateObjectParams = Omit<
  Parameters<typeof generateObject>[0],
  "model" | "schema"
> & { schema: FlexibleSchema<unknown> };

export async function generateTextWithModelFallback(
  params: GenerateTextParams,
  kind: "discussion" | "performance",
): Promise<Awaited<ReturnType<typeof generateText>>> {
  const models =
    kind === "discussion"
      ? getDiscussionModelsOrdered()
      : getPerformanceModelsOrdered();
  if (models.length === 0) {
    throw new Error(
      "No AI providers configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY.",
    );
  }
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      return await generateText({
        ...params,
        model: models[i],
      } as Parameters<typeof generateText>[0]);
    } catch (e) {
      lastErr = e;
      if (i < models.length - 1) {
        console.warn(
          `[ai] generateText ${kind} fallback ${i + 1}→${i + 2}/${models.length}:`,
          e instanceof Error ? e.message : e,
        );
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export async function generateObjectWithModelFallback(
  params: GenerateObjectParams,
  kind: "discussion" | "performance",
): Promise<Awaited<ReturnType<typeof generateObject>>> {
  const models =
    kind === "discussion"
      ? getDiscussionModelsOrdered()
      : getPerformanceModelsOrdered();
  if (models.length === 0) {
    throw new Error(
      "No AI providers configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY.",
    );
  }
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      return await generateObject({
        ...params,
        model: models[i],
      } as Parameters<typeof generateObject>[0]);
    } catch (e) {
      lastErr = e;
      if (i < models.length - 1) {
        console.warn(
          `[ai] generateObject ${kind} fallback ${i + 1}→${i + 2}/${models.length}:`,
          e instanceof Error ? e.message : e,
        );
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
