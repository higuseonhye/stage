import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureWorkspaceForUser } from "@/lib/workspace";
import {
  countRunsCreatedSinceUtc,
  MAX_RUNS_PER_DAY,
  utcDayStartIso,
} from "@/lib/daily-run-quota";
import {
  countRunsForQuestion,
  MAX_RUNS_PER_QUESTION,
} from "@/lib/question-run-limit";
import {
  contextGraphSchema,
  initialSnapshotFromGraph,
  isSnapshotSeedableEmpty,
} from "@/lib/context-graph";

const createSchema = z.object({
  topic: z.string().min(1).max(2000),
  userMessage: z.string().max(8000).optional().default(""),
  projectId: z.string().uuid().optional(),
  /** If the linked project has an empty snapshot, seed it from this graph. */
  contextGraph: contextGraphSchema.optional(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { topic, userMessage, projectId, contextGraph } = parsed.data;

  try {
    if (projectId) {
      const { data: proj, error: pe } = await supabase
        .from("projects")
        .select("id, context_snapshot")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (pe || !proj) {
        return NextResponse.json(
          { error: "Invalid or unknown project" },
          { status: 400 },
        );
      }
      if (
        contextGraph &&
        isSnapshotSeedableEmpty(proj.context_snapshot)
      ) {
        await supabase
          .from("projects")
          .update({
            context_snapshot: initialSnapshotFromGraph(contextGraph),
          })
          .eq("id", projectId);
      }
    }

    const usedToday = await countRunsCreatedSinceUtc(
      supabase,
      user.id,
      utcDayStartIso(),
    );
    if (usedToday >= MAX_RUNS_PER_DAY) {
      return NextResponse.json(
        {
          error: `You've used all ${MAX_RUNS_PER_DAY} runs for today. Resets at midnight UTC.`,
        },
        { status: 429 },
      );
    }

    const usedForQuestion = await countRunsForQuestion(
      supabase,
      user.id,
      topic,
      userMessage,
    );
    if (usedForQuestion >= MAX_RUNS_PER_QUESTION) {
      return NextResponse.json(
        {
          error:
            "Maximum 3 runs for this question (same topic and brief). Change the wording or brief to run again.",
        },
        { status: 429 },
      );
    }

    const workspaceId = await ensureWorkspaceForUser(supabase, user.id);
    const { data: run, error } = await supabase
      .from("runs")
      .insert({
        workspace_id: workspaceId,
        topic,
        user_message: userMessage,
        status: "discussing",
        project_id: projectId ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabase.from("audit_events").insert({
      run_id: run.id,
      event_type: "run_started",
      payload: { topic, user_id: user.id, project_id: projectId ?? null },
    });

    return NextResponse.json({ id: run.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to create run" },
      { status: 500 },
    );
  }
}
