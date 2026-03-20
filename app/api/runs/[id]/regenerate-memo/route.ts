import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { persistDecisionMemoForRun } from "@/lib/persist-decision-memo";

export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id: runId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: run } = await supabase
    .from("runs")
    .select("id, workspace_id, status")
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

  if (run.status !== "completed") {
    return NextResponse.json(
      {
        error:
          "Run must be completed before generating a decision memo (finish performance first).",
      },
      { status: 409 },
    );
  }

  const [{ count: stepCount, error: stepErr }, { count: gateCount, error: gateErr }] =
    await Promise.all([
      supabase
        .from("execution_steps")
        .select("*", { count: "exact", head: true })
        .eq("run_id", runId),
      supabase
        .from("approval_gates")
        .select("*", { count: "exact", head: true })
        .eq("run_id", runId),
    ]);

  if (stepErr || gateErr) {
    return NextResponse.json(
      { error: "Could not verify run artifacts" },
      { status: 500 },
    );
  }
  const hasSteps = (stepCount ?? 0) >= 1;
  const hasGate = (gateCount ?? 0) >= 1;
  if (!hasSteps && !hasGate) {
    return NextResponse.json(
      {
        error:
          "Nothing to summarize — this run has no approval gate or execution steps.",
      },
      { status: 409 },
    );
  }

  const result = await persistDecisionMemoForRun(supabase, runId);
  if (!result.ok) {
    const status =
      result.reason === "missing_approval_context" ? 409 : 500;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({
    ok: true,
    length: result.markdownLength,
  });
}
