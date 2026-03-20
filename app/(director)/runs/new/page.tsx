"use client";

import { useCallback, useEffect, useState } from "react";
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
  FIRST_HIRE_EXAMPLE_ID,
  isFirstHireExampleContent,
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
  const [quota, setQuota] = useState<{
    daily: { remaining: number; limit: number; resetsAt: string };
    question: { remaining: number; limit: number; applies: boolean };
  } | null>(null);

  const loadQuota = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("topic", topic);
      params.set("userMessage", userMessage);
      const res = await fetch(`/api/runs/quota?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const j = (await res.json()) as {
        daily?: { limit: number; used: number; remaining: number; resetsAt: string };
        question?: {
          limit: number;
          used: number;
          remaining: number;
          applies: boolean;
        };
      };
      if (j.daily && j.question) {
        setQuota({
          daily: {
            remaining: j.daily.remaining,
            limit: j.daily.limit,
            resetsAt: j.daily.resetsAt ?? "",
          },
          question: {
            remaining: j.question.remaining,
            limit: j.question.limit,
            applies: j.question.applies,
          },
        });
      }
    } catch {
      /* ignore */
    }
  }, [topic, userMessage]);

  useEffect(() => {
    const t = setTimeout(() => void loadQuota(), 400);
    return () => clearTimeout(t);
  }, [loadQuota]);

  const applyExample = (id: string) => {
    const ex = STAGE_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setSelectedExampleId(id);
    setTopic(ex.topic);
    setUserMessage(ex.brief);
  };

  const showFirstHireMemoLink =
    selectedExampleId === FIRST_HIRE_EXAMPLE_ID ||
    isFirstHireExampleContent(topic, userMessage);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, userMessage }),
        credentials: "include",
      });
      const j = (await res.json()) as { id?: string; error?: unknown };
      if (!res.ok) {
        void loadQuota();
        throw new Error(
          typeof j.error === "string" ? j.error : "Could not create run",
        );
      }
      if (j.id) {
        void loadQuota();
        router.push(`/runs/${j.id}`);
      }
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
      <p className="text-muted-foreground mb-2 text-sm">
        Give the actors a topic and brief. You&apos;ll cue approval before
        anything executes.
      </p>
      <div className="text-muted-foreground mb-6 space-y-1 font-mono text-xs leading-relaxed">
        {quota ? (
          <>
            <p>
              <span className="text-foreground/90">
                {quota.question.remaining} / {quota.question.limit}
              </span>{" "}
              runs left for{" "}
              <span className="text-foreground/80">this question</span>{" "}
              <span className="opacity-70">(topic + brief, normalized)</span>
            </p>
            <p>
              <span className="text-foreground/90">
                {quota.daily.remaining} / {quota.daily.limit}
              </span>{" "}
              runs remaining <span className="text-foreground/80">today</span>{" "}
              <span className="opacity-70">(UTC day)</span>
              {quota.daily.resetsAt ? (
                <span className="mt-0.5 block opacity-60">
                  Daily reset:{" "}
                  {new Date(quota.daily.resetsAt).toLocaleString(undefined, {
                    timeZone: "UTC",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  UTC
                </span>
              ) : null}
            </p>
          </>
        ) : (
          <p className="opacity-60">Checking quotas…</p>
        )}
      </div>

      <div className="mb-8 space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Example runs
        </h2>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Click a card to fill the form. See{" "}
          <code className="text-foreground/90">STAGE_EXAMPLES.md</code> for full
          copy.
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          <Link
            href="/resources/decision-memo"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Open the decision one-pager
          </Link>{" "}
          — generic printable memo for any run (options, risks, cue, sign-off);{" "}
          <code className="text-foreground/80">docs/decision-memo.md</code>. Also
          in the top nav as <span className="text-foreground/80">Decision memo</span>.
        </p>
        {showFirstHireMemoLink ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            <Link
              href="/resources/first-hire-memo"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Open the first-hire add-on memo
            </Link>{" "}
            — extra one-pager for the engineer vs sales hire scenario;{" "}
            <code className="text-foreground/80">docs/first-hire-decision-memo.md</code>.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {STAGE_EXAMPLES.map((ex) => {
            const isDefault = ex.id === DEFAULT_EXAMPLE_ID;
            const isSelected = selectedExampleId === ex.id;
            const isFirstHire = ex.id === FIRST_HIRE_EXAMPLE_ID;
            const cardClass = cn(
              "focus-within:ring-ring flex h-full flex-col overflow-hidden rounded-xl border-2 p-0 shadow-none transition-colors focus-within:ring-2",
              isSelected &&
                isDefault &&
                "border-emerald-600/60 bg-emerald-500/5 ring-2 ring-emerald-500/35",
              isSelected &&
                !isDefault &&
                "border-primary bg-primary/5 ring-2 ring-primary/35",
              !isSelected &&
                "border-border/80 bg-card/40 hover:border-border hover:bg-card/60",
            );
            return (
              <Card key={ex.id} className={cardClass}>
                <button
                  type="button"
                  onClick={() => applyExample(ex.id)}
                  className={cn(
                    "w-full flex-1 p-4 text-left outline-none",
                    "focus-visible:bg-muted/30",
                    isFirstHire ? "rounded-t-xl" : "rounded-xl",
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
                </button>
                {isFirstHire ? (
                  <div className="border-border/80 bg-muted/25 rounded-b-xl border-t px-4 py-2.5">
                    <Link
                      href="/resources/first-hire-memo"
                      className="text-primary text-xs font-medium underline-offset-4 hover:underline"
                    >
                      First-hire add-on memo{" "}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                ) : null}
              </Card>
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
        <Button
          type="submit"
          disabled={
            busy ||
            (quota !== null &&
              (quota.daily.remaining <= 0 ||
                (quota.question.applies && quota.question.remaining <= 0)))
          }
        >
          {busy ? "Creating…" : "Open the stage"}
        </Button>
      </form>
    </div>
  );
}
