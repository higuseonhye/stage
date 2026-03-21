import { generateTextWithModelFallback } from "@/lib/model-fallback";

const AGENT_ORDER = ["analyst", "critic", "strategist", "executor"] as const;

export type FullConvergence = {
  /** Panel-wide improvement vs previous round (0–100) */
  improvement: number;
  critic_new_objections: boolean;
  strategist_new_options: boolean;
  /** Per-agent improvement of that actor’s text vs previous round (0–100) */
  perAgent: Record<string, number>;
};

function formatRound(texts: Record<string, string>): string {
  return AGENT_ORDER.map(
    (id) => `### ${id}\n${texts[id] ?? "(empty)"}`,
  ).join("\n\n");
}

function extractJsonObject(text: string): unknown {
  const t = text.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function clampInt(n: unknown, fallback: number): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, x));
}

function normalizePerAgent(
  raw: unknown,
  fallbackEach: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of AGENT_ORDER) {
    out[id] = 0;
  }
  if (!raw || typeof raw !== "object") {
    for (const id of AGENT_ORDER) out[id] = fallbackEach;
    return out;
  }
  const o = raw as Record<string, unknown>;
  for (const id of AGENT_ORDER) {
    out[id] = clampInt(o[id], 0);
  }
  const allZero = AGENT_ORDER.every((id) => out[id] === 0);
  if (allZero) {
    for (const id of AGENT_ORDER) out[id] = fallbackEach;
  }
  return out;
}

export async function evaluateDiscussionConvergence(params: {
  previousRound: Record<string, string>;
  currentRound: Record<string, string>;
}): Promise<FullConvergence> {
  const { text } = await generateTextWithModelFallback(
    {
      maxOutputTokens: 1024,
      prompt: `You compare two consecutive discussion rounds from a four-agent panel (analyst, critic, strategist, executor).

## Previous round
${formatRound(params.previousRound)}

## Current round
${formatRound(params.currentRound)}

Return ONLY a single JSON object (no markdown fences, no prose) with exactly these keys:
- "improvement": integer 0-100, how much the current round improved substantive quality vs the previous round overall (0 = none, 100 = major step forward)
- "critic_new_objections": boolean, true if the Critic added materially new risks or challenges not already in the previous round
- "strategist_new_options": boolean, true if the Strategist added materially new strategic options or materially changed the recommended plan vs the previous round
- "per_agent": object with keys "analyst", "critic", "strategist", "executor" — each an integer 0-100 for how much THAT actor's message improved vs their previous-round message (rephrasing with no new substance = low score)

Example shape: {"improvement":45,"critic_new_objections":true,"strategist_new_options":false,"per_agent":{"analyst":60,"critic":30,"strategist":55,"executor":20}}`,
    },
    "discussion",
  );

  const parsed = extractJsonObject(text);
  const obj =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;

  const improvement = clampInt(obj?.improvement, 50);
  const perAgent = normalizePerAgent(obj?.per_agent, improvement);

  return {
    improvement,
    critic_new_objections: Boolean(obj?.critic_new_objections),
    strategist_new_options: Boolean(obj?.strategist_new_options),
    perAgent,
  };
}
