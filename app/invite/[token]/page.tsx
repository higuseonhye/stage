"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { cn } from "@/lib/utils";

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const accept = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      const res = await fetch("/api/workspace/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : res.statusText);
      }
      setOk(true);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [router, token]);

  return (
    <div className="flex min-h-full flex-col">
      <PublicSiteHeader />
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-16">
        <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">
          Workspace invite
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Join a Stage workspace
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          You&apos;ll be able to open runs, hold the cue, and see the script in
          this team workspace. Sign in with the account that should receive
          access, then accept.
        </p>
        {err ? (
          <p className="text-destructive mt-4 font-mono text-xs">{err}</p>
        ) : null}
        {ok ? (
          <p className="text-emerald-600 dark:text-emerald-400 mt-4 text-sm">
            Joined — redirecting…
          </p>
        ) : (
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={busy || !token}
              onClick={() => void accept()}
            >
              {busy ? "Joining…" : "Accept invite"}
            </Button>
            <Link
              href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Create account
            </Link>
          </div>
        )}
        <p className="text-muted-foreground mt-8 text-xs">
          If the database migration for team invites is not applied yet, accept
          will fail — run{" "}
          <code className="text-foreground/90">20250321180000_workspace_team.sql</code>{" "}
          in Supabase SQL Editor.
        </p>
      </main>
    </div>
  );
}
