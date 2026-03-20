"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewRunPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, userMessage }),
      });
      const j = (await res.json()) as { id?: string; error?: unknown };
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : "Could not create run",
        );
      }
      if (j.id) router.push(`/runs/${j.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

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
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">New run</h1>
      <p className="text-muted-foreground mb-8 text-sm">
        Give the actors a topic and brief. You&apos;ll cue approval before
        anything executes.
      </p>

      <form onSubmit={submit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="topic">Topic</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Analyze Q3 churn and propose retention actions"
            required
            minLength={1}
            maxLength={2000}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brief">Director brief (optional)</Label>
          <Textarea
            id="brief"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            placeholder="Constraints, context, links…"
            rows={5}
            maxLength={8000}
            className="font-mono text-sm"
          />
        </div>
        {err ? (
          <p className="text-destructive font-mono text-sm">{err}</p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Open the stage"}
        </Button>
      </form>
    </div>
  );
}
