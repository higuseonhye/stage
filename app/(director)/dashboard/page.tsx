import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccessibleWorkspaceIds } from "@/lib/workspace-access";
import { ensureWorkspaceForUser } from "@/lib/workspace";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProjectContextSnapshot } from "@/components/ProjectContextSnapshot";
import { DashboardOnboarding } from "@/components/DashboardOnboarding";

type RunRow = {
  id: string;
  topic: string;
  status: string;
  created_at: string;
  project_id: string | null;
  workspace_id?: string;
};

type ProjectRow = {
  id: string;
  name: string;
  goal: string | null;
  created_at: string;
  context_snapshot: Record<string, unknown> | null;
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceIds = await getAccessibleWorkspaceIds(supabase, user.id);
  const ownedWorkspaceId = await ensureWorkspaceForUser(supabase, user.id);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, goal, created_at, context_snapshot")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: runs } =
    workspaceIds.length > 0
      ? await supabase
          .from("runs")
          .select("id, topic, status, created_at, project_id, workspace_id")
          .in("workspace_id", workspaceIds)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: [] as RunRow[] };

  const runList = (runs ?? []) as RunRow[];
  const projectList = (projects ?? []) as ProjectRow[];

  const unassigned = runList.filter((r) => !r.project_id);
  const byProject = new Map<string, RunRow[]>();
  for (const r of runList) {
    if (!r.project_id) continue;
    const arr = byProject.get(r.project_id) ?? [];
    arr.push(r);
    byProject.set(r.project_id, arr);
  }

  function lastRunDate(rs: RunRow[]): string | null {
    if (!rs.length) return null;
    const t = Math.max(...rs.map((x) => new Date(x.created_at).getTime()));
    return new Date(t).toISOString();
  }

  function isSharedTeamRun(r: RunRow) {
    return (
      Boolean(r.workspace_id) &&
      r.workspace_id !== ownedWorkspaceId
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <DashboardOnboarding />
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Grouped by project. Each run: discussion, cue, execution, script.
          </p>
        </div>
        <Link
          href="/runs/new"
          className={cn(buttonVariants({ variant: "default", size: "default" }))}
        >
          New run
        </Link>
      </div>

      <div className="space-y-10">
        {projectList.length === 0 && unassigned.length === 0 ? (
          <div className="text-muted-foreground border-border/60 rounded-lg border border-dashed p-8 text-center text-sm">
            No runs yet.{" "}
            <Link href="/runs/new" className="text-foreground underline">
              Start one
            </Link>{" "}
            — optionally attach a project on the new-run page so context
            accumulates.
          </div>
        ) : null}

        {projectList.map((p) => {
          const pruns = byProject.get(p.id) ?? [];
          const last = lastRunDate(pruns);
          return (
            <section key={p.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {p.name}
                  </h2>
                  {p.goal ? (
                    <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                      {p.goal}
                    </p>
                  ) : null}
                  <ProjectContextSnapshot snapshot={p.context_snapshot} />
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-3 font-mono text-xs">
                  <span>
                    {pruns.length} run{pruns.length === 1 ? "" : "s"}
                  </span>
                  {last ? (
                    <span>
                      Last:{" "}
                      {new Date(last).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  ) : (
                    <span>No runs yet</span>
                  )}
                </div>
              </div>
              {pruns.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No runs linked to this project yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {pruns.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/runs/${r.id}`}
                        className="border-border/70 bg-card/40 hover:bg-card/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 transition-colors"
                      >
                        <span className="font-medium">{r.topic}</span>
                        <div className="flex items-center gap-2">
                          {isSharedTeamRun(r) ? (
                            <Badge
                              variant="secondary"
                              className="font-mono text-[10px] uppercase"
                            >
                              Team
                            </Badge>
                          ) : null}
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] uppercase"
                          >
                            {r.status.replace(/_/g, " ")}
                          </Badge>
                          <time className="text-muted-foreground font-mono text-xs">
                            {new Date(r.created_at).toLocaleString()}
                          </time>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        {unassigned.length > 0 ? (
          <section className="space-y-3">
            <div className="border-border/60 border-b pb-2">
              <h2 className="text-muted-foreground text-sm font-semibold tracking-tight">
                No project
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Runs created without linking a project.
              </p>
            </div>
            <ul className="space-y-2">
              {unassigned.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/runs/${r.id}`}
                    className="border-border/70 bg-card/40 hover:bg-card/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 transition-colors"
                  >
                    <span className="font-medium">{r.topic}</span>
                    <div className="flex items-center gap-2">
                      {isSharedTeamRun(r) ? (
                        <Badge
                          variant="secondary"
                          className="font-mono text-[10px] uppercase"
                        >
                          Team
                        </Badge>
                      ) : null}
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] uppercase"
                      >
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                      <time className="text-muted-foreground font-mono text-xs">
                        {new Date(r.created_at).toLocaleString()}
                      </time>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
