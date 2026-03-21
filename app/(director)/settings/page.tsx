"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SettingsWorkspaceInvites } from "@/components/SettingsWorkspaceInvites";

const THEME_KEY = "stage-light-mode";

const RESET_CONFIRM = "DELETE_ALL_RUNS";

export default function SettingsPage() {
  const router = useRouter();
  const [light, setLight] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);
  const [resetOk, setResetOk] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        setLight(localStorage.getItem(THEME_KEY) === "1");
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", !light);
    try {
      localStorage.setItem(THEME_KEY, light ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [light]);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link
        href="/dashboard"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-6 -ml-2 inline-flex",
        )}
      >
        ← Runs
      </Link>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Workspace and environment notes for the director console.
      </p>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="light">Light mode</Label>
            <p className="text-muted-foreground mt-1 text-xs">
              Default is dark. Toggle for a light director console.
            </p>
          </div>
          <Switch
            id="light"
            checked={light}
            onCheckedChange={setLight}
          />
        </div>

        <Separator />

        <div>
          <h2 className="mb-2 text-sm font-medium">API keys</h2>
          <p className="text-muted-foreground font-mono text-xs leading-relaxed">
            Configure <code className="text-foreground">ANTHROPIC_API_KEY</code>
            , <code className="text-foreground">OPENAI_API_KEY</code>, and
            Supabase keys in <code className="text-foreground">.env.local</code>{" "}
            locally or in Vercel project settings for production. This UI does
            not store secrets.
          </p>
        </div>

        <Separator />

        <SettingsWorkspaceInvites />

        <Separator />

        <div>
          <h2 className="mb-2 text-sm font-medium">Your workspace</h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Each account has a default workspace (created on first run).
            Invited members work inside the owner&apos;s workspace when they use
            an invite link.
          </p>
        </div>

        <Separator />

        <div className="border-destructive/40 rounded-lg border border-dashed p-4">
          <h2 className="text-destructive mb-1 text-sm font-medium">
            Delete all runs
          </h2>
          <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
            Removes every run in your workspace: discussion, cue, performance,
            audit, and generated decision memos.{" "}
            <span className="text-foreground/90 font-medium">
              Cannot be undone.
            </span>
          </p>
          <Label htmlFor="reset-confirm" className="text-xs">
            Type{" "}
            <code className="text-foreground/90 bg-muted rounded px-1 py-0.5">
              {RESET_CONFIRM}
            </code>{" "}
            to confirm
          </Label>
          <Input
            id="reset-confirm"
            value={resetPhrase}
            onChange={(e) => {
              setResetPhrase(e.target.value);
              setResetErr(null);
              setResetOk(null);
            }}
            className="mt-1.5 font-mono text-xs"
            placeholder={RESET_CONFIRM}
            autoComplete="off"
          />
          {resetErr ? (
            <p className="text-destructive mt-2 font-mono text-xs">{resetErr}</p>
          ) : null}
          {resetOk ? (
            <p className="text-emerald-600 dark:text-emerald-400 mt-2 font-mono text-xs">
              {resetOk}
            </p>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="mt-3"
            disabled={
              resetBusy || resetPhrase.trim() !== RESET_CONFIRM
            }
            onClick={async () => {
              setResetBusy(true);
              setResetErr(null);
              setResetOk(null);
              try {
                const res = await fetch("/api/runs/reset", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ confirm: RESET_CONFIRM }),
                });
                const j = (await res.json()) as {
                  ok?: boolean;
                  deletedCount?: number;
                  error?: string;
                };
                if (!res.ok) {
                  throw new Error(
                    typeof j.error === "string" ? j.error : res.statusText,
                  );
                }
                setResetPhrase("");
                setResetOk(
                  `Deleted ${j.deletedCount ?? 0} run(s). Redirecting…`,
                );
                router.refresh();
                setTimeout(() => router.push("/dashboard"), 800);
              } catch (e) {
                setResetErr(
                  e instanceof Error ? e.message : String(e),
                );
              } finally {
                setResetBusy(false);
              }
            }}
          >
            {resetBusy ? "Deleting…" : "Delete all runs"}
          </Button>
        </div>
      </div>
    </div>
  );
}
