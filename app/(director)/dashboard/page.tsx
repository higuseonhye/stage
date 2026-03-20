import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const { data: runs } = workspace
    ? await supabase
        .from("runs")
        .select("id, topic, status, created_at")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as { id: string; topic: string; status: string; created_at: string }[] };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Each run is one performance: discussion, cue, execution, script.
          </p>
        </div>
        <Link
          href="/runs/new"
          className={cn(buttonVariants({ variant: "default", size: "default" }))}
        >
          New run
        </Link>
      </div>

      <ul className="space-y-2">
        {(runs ?? []).length === 0 ? (
          <li className="text-muted-foreground border-border/60 rounded-lg border border-dashed p-8 text-center text-sm">
            No runs yet.{" "}
            <Link href="/runs/new" className="text-foreground underline">
              Start one
            </Link>
            .
          </li>
        ) : (
          (runs ?? []).map((r) => (
            <li key={r.id}>
              <Link
                href={`/runs/${r.id}`}
                className="border-border/70 bg-card/40 hover:bg-card/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 transition-colors"
              >
                <span className="font-medium">{r.topic}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {r.status.replace(/_/g, " ")}
                  </Badge>
                  <time className="text-muted-foreground font-mono text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </time>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
