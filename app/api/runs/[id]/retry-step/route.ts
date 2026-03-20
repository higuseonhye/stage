import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { executePerformanceStep } from "@/lib/execution";

const bodySchema = z.object({
  stepId: z.string().uuid(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id: runId } = await context.params;
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten(), { status: 400 });
  }

  const { stepId } = parsed.data;

  const { data: run } = await supabase
    .from("runs")
    .select("id, workspace_id, topic, status")
    .eq("id", runId)
    .maybeSingle();

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", run.workspace_id)
    .maybeSingle();

  if (!workspace || workspace.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: step } = await supabase
    .from("execution_steps")
    .select("id, run_id, agent_id, input, status")
    .eq("id", stepId)
    .eq("run_id", runId)
    .maybeSingle();

  if (!step) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  if (step.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed steps can be retried" },
      { status: 409 },
    );
  }

  await supabase
    .from("execution_steps")
    .update({
      status: "queued",
      output: "",
      started_at: null,
      finished_at: null,
    })
    .eq("id", stepId);

  try {
    await executePerformanceStep({
      supabase,
      stepRow: {
        id: step.id,
        run_id: step.run_id,
        agent_id: step.agent_id,
        input: step.input,
      },
      topic: run.topic,
    });

    const { data: failed } = await supabase
      .from("execution_steps")
      .select("id")
      .eq("run_id", runId)
      .eq("status", "failed")
      .limit(1);

    if (!failed?.length) {
      await supabase
        .from("runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      await supabase.from("audit_events").insert({
        run_id: runId,
        event_type: "run_completed",
        payload: { after_retry: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Retry failed" }, { status: 500 });
  }
}
