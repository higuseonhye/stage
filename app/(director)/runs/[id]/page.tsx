import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchRunForPage } from "@/lib/fetch-run-for-page";
import { RunDetail } from "@/components/RunDetail";

type PageProps = { params: Promise<{ id: string }> };

export default async function RunPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: run, error: runErr } = await fetchRunForPage(supabase, id);

  if (runErr || !run) notFound();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", run.workspace_id)
    .maybeSingle();

  if (!workspace || workspace.owner_id !== user.id) notFound();

  const [
    { data: messages },
    { data: gates },
    { data: steps },
    { data: audit },
  ] = await Promise.all([
    supabase
      .from("agent_messages")
      .select("*")
      .eq("run_id", id)
      .order("round", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("approval_gates").select("*").eq("run_id", id),
    supabase
      .from("execution_steps")
      .select("*")
      .eq("run_id", id)
      .order("step_index", { ascending: true }),
    supabase
      .from("audit_events")
      .select("*")
      .eq("run_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <RunDetail
      runId={id}
      initialRun={{
        id: run.id,
        topic: run.topic,
        user_message: run.user_message,
        status: run.status,
        created_at: run.created_at,
        completed_at: run.completed_at,
        decision_memo_markdown: run.decision_memo_markdown ?? null,
      }}
      initialMessages={messages ?? []}
      initialGates={gates ?? []}
      initialSteps={steps ?? []}
      initialAudit={audit ?? []}
    />
  );
}
