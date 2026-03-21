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
  graph: contextGraphSchema,
  feedback: z.string().min(1).max(4000),
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

  const { graph, feedback } = parsed.data;
  const current = contextGraphSchema.parse(graph);

  try {
    const { object } = await generateObjectWithModelFallback(
      {
        schema: contextGraphSchema,
        prompt: `Current context graph:
${JSON.stringify(current, null, 2)}

User feedback (what to fix or add):
${feedback}

Return an updated context graph that incorporates this feedback. Keep fields unchanged unless the feedback implies a change.`,
      },
      "performance",
    );

    return NextResponse.json({ graph: object });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to refine context graph",
      },
      { status: 500 },
    );
  }
}
