import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { contextGraphSchema } from "@/lib/context-graph";
import { generateObjectWithModelFallback } from "@/lib/model-fallback";
import {
  RateLimitExceededError,
  enforceContextRateLimit,
} from "@/lib/rate-limit";

export const maxDuration = 120;

const bodySchema = z.object({
  line: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await enforceContextRateLimit(request, user.id);
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    throw e;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten(), { status: 400 });
  }

  const { line } = parsed.data;

  try {
    const { object } = await generateObjectWithModelFallback(
      {
        schema: contextGraphSchema,
        prompt: `The user described their situation in ONE short line (may be any language):

"""
${line}
"""

Infer a context graph. Be concise. Where facts are missing, state reasonable hypotheses briefly inside the relevant fields (e.g. "Assumed: …"). 
competition: 2–5 short names or phrases (competitors or substitutes).
stage: choose the best fit among idea | mvp | growth.`,
      },
      "performance",
    );

    return NextResponse.json({ graph: object });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to infer context graph",
      },
      { status: 500 },
    );
  }
}
