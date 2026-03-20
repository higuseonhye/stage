"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_EXAMPLE_ID,
  STAGE_EXAMPLES,
} from "@/lib/stage-examples";

const defaultExample = STAGE_EXAMPLES.find((e) => e.id === DEFAULT_EXAMPLE_ID)!;

export default function NewRunPage() {
  const router = useRouter();
  const [topic, setTopic] = useState(defaultExample.topic);
  const [userMessage, setUserMessage] = useState(defaultExample.brief);
  const [selectedExampleId, setSelectedExampleId] = useState<string>(
    DEFAULT_EXAMPLE_ID,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const applyExample = (id: string) => {
    const ex = STAGE_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setSelectedExampleId(id);
    setTopic(ex.topic);
    setUserMessage(ex.brief);
  };

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
    <div className="mx-auto max-w-2xl px-4 py-8">
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
      <p className="text-muted-foreground mb-6 text-sm">
        Give the actors a topic and brief. You&apos;ll cue approval before
        anything executes.
      </p>

      <div className="mb-8 space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Example runs
        </h2>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Click a card to fill the form. See{" "}
          <code className="text-foreground/90">STAGE_EXAMPLES.md</code> for full
          copy.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {STAGE_EXAMPLES.map((ex) => {
            const isDefault = ex.id === DEFAULT_EXAMPLE_ID;
            const isSelected = selectedExampleId === ex.id;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => applyExample(ex.id)}
                className={cn(
                  "text-left transition-colors",
                  "focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none",
                )}
              >
                <Card
                  className={cn(
                    "h-full overflow-visible border-2 p-4 shadow-none",
                    isSelected && isDefault &&
                      "border-emerald-600/60 bg-emerald-500/5 ring-2 ring-emerald-500/35",
                    isSelected &&
                      !isDefault &&
                      "border-primary bg-primary/5 ring-2 ring-primary/35",
                    !isSelected &&
                      "border-border/80 bg-card/40 hover:border-border hover:bg-card/60",
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{ex.title}</span>
                    {isDefault ? (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/15 font-mono text-[10px] text-emerald-200/95 uppercase"
                      >
                        Default
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs leading-snug">
                    {ex.topic}
                  </p>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

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
