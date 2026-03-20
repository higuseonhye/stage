"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { DiscussionPanel } from "@/components/DiscussionPanel";
import { ApprovalGate } from "@/components/ApprovalGate";
import { MemoMarkdown } from "@/components/MemoMarkdown";
import { ExecutionTimeline, type StepRow } from "@/components/ExecutionTimeline";
import { AuditLog, type AuditRow } from "@/components/AuditLog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  latestContentByAgent,
  latestCriticContent,
} from "@/lib/run-messages";

export type RunRow = {
  id: string;
  topic: string;
  user_message: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  decision_memo_markdown: string | null;
};

export type AgentMessageRow = {
  id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  round: number;
  created_at: string;
};

export type GateRow = {
  id: string;
  action_plan: string;
  status: string;
  human_note: string | null;
  created_at: string;
  decided_at: string | null;
};

type Props = {
  runId: string;
  initialRun: RunRow;
  initialMessages: AgentMessageRow[];
  initialGates: GateRow[];
  initialSteps: StepRow[];
  initialAudit: AuditRow[];
};

export function RunDetail({
  runId,
  initialRun,
  initialMessages,
  initialGates,
  initialSteps,
  initialAudit,
}: Props) {
  const [run, setRun] = useState(initialRun);
  const [gates, setGates] = useState(initialGates);
  const [steps, setSteps] = useState(initialSteps);
  const [audit, setAudit] = useState(initialAudit);
  const [messages, setMessages] = useState(initialMessages);
  const [criticExcerpt, setCriticExcerpt] = useState("");
  const [memoBusy, setMemoBusy] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);

  const pendingGate =
    gates.find((g) => g.status === "pending") ?? null;

  const discussDisabled =
    run.status !== "discussing" || gates.length > 0;

  const persistedAgentTexts = useMemo(
    () => latestContentByAgent(messages),
    [messages],
  );

  const criticFromMessages = useMemo(
    () => latestCriticContent(messages),
    [messages],
  );

  const refresh = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const [{ data: rBase }, { data: g }, { data: st }, { data: au }, { data: msg }] =
      await Promise.all([
        supabase
          .from("runs")
          .select(
            "id, topic, user_message, status, created_at, completed_at",
          )
          .eq("id", runId)
          .single(),
        supabase.from("approval_gates").select("*").eq("run_id", runId),
        supabase.from("execution_steps").select("*").eq("run_id", runId),
        supabase.from("audit_events").select("*").eq("run_id", runId),
        supabase
          .from("agent_messages")
          .select("*")
          .eq("run_id", runId)
          .order("round", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
    let r = rBase as RunRow | null;
    if (r) {
      const memoRes = await supabase
        .from("runs")
        .select("decision_memo_markdown")
        .eq("id", runId)
        .maybeSingle();
      const memo =
        !memoRes.error && memoRes.data
          ? ((memoRes.data as { decision_memo_markdown?: string | null })
              .decision_memo_markdown ?? null)
          : null;
      r = { ...r, decision_memo_markdown: memo };
    }
    if (r) setRun(r);
    if (g) setGates(g as GateRow[]);
    if (st) setSteps(st as StepRow[]);
    if (au) setAudit(au as AuditRow[]);
    if (msg) setMessages(msg as AgentMessageRow[]);
  }, [runId]);

  const regenerateMemo = useCallback(async () => {
    setMemoBusy(true);
    setMemoError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/regenerate-memo`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setMemoError(
          typeof json.error === "string" ? json.error : res.statusText,
        );
        return;
      }
      await refresh();
    } catch (e) {
      setMemoError(e instanceof Error ? e.message : String(e));
    } finally {
      setMemoBusy(false);
    }
  }, [runId, refresh]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`run-detail:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "runs",
          filter: `id=eq.${runId}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "approval_gates",
          filter: `run_id=eq.${runId}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "execution_steps",
          filter: `run_id=eq.${runId}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_events",
          filter: `run_id=eq.${runId}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_messages",
          filter: `run_id=eq.${runId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [runId, refresh]);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mb-2 -ml-2 inline-flex",
            )}
          >
            ← Runs
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{run.topic}</h1>
          {run.user_message ? (
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              {run.user_message}
            </p>
          ) : null}
        </div>
        <Badge variant="outline" className="font-mono text-xs uppercase">
          {run.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Stage — discussion
        </h2>
        <DiscussionPanel
          runId={runId}
          disabled={discussDisabled}
          persistedTexts={persistedAgentTexts}
          onDiscussionComplete={(_, excerpt) => setCriticExcerpt(excerpt)}
        />
        {messages.length > 0 ? (
          <details className="border-border/60 bg-muted/10 rounded-lg border p-3">
            <summary className="cursor-pointer font-mono text-xs tracking-wide uppercase">
              Saved transcript ({messages.length} turns)
            </summary>
            <ul className="mt-3 space-y-3">
              {messages.map((m) => (
                <li key={m.id} className="font-mono text-xs">
                  <span className="text-muted-foreground">
                    R{m.round} · {m.agent_name}
                  </span>
                  <pre className="mt-1 whitespace-pre-wrap">{m.content}</pre>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Cue — approval gate
        </h2>
        <ApprovalGate
          gate={pendingGate}
          criticExcerpt={criticExcerpt || criticFromMessages}
          runId={runId}
          onDecided={() => void refresh()}
        />
        {!pendingGate && gates.length > 0 ? (
          <p className="text-muted-foreground font-mono text-sm">
            {(() => {
              const g = [...gates].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              )[0];
              return (
                <>
                  Cue resolved ({g.status}).{" "}
                  {g.human_note ? `Note: ${g.human_note}` : null}
                </>
              );
            })()}
          </p>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Performance — execution
        </h2>
        <ExecutionTimeline runId={runId} steps={steps} />
      </section>

      {run.status === "completed" ? (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              Decision memo — generated
            </h2>
            {run.decision_memo_markdown?.trim() ? (
              <div className="border-border/60 bg-card/30 rounded-lg border p-4">
                <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
                  Filled automatically when the run finishes (
                  <code className="text-foreground/80">PERFORMANCE_MODEL</code>
                  ; after approve + performance, or after deny). Blank template
                  for your own notes:{" "}
                  <Link
                    href="/resources/decision-memo"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    /resources/decision-memo
                  </Link>
                  .
                </p>
                <div className="max-h-[min(70vh,720px)] overflow-y-auto rounded-md border border-border/50 bg-background/50 p-3">
                  <MemoMarkdown source={run.decision_memo_markdown} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  No generated memo stored yet. Common cases: this run finished
                  before the memo column existed, generation failed (see script
                  for{" "}
                  <code className="text-foreground/80">decision_memo_failed</code>
                  ), or the pipeline has not finished writing. Printable blank:{" "}
                  <Link
                    href="/resources/decision-memo"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    decision memo template
                  </Link>
                  .
                </p>
                {steps.length > 0 || gates.length > 0 ? (
                  <div className="flex flex-col items-start gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={memoBusy}
                      onClick={() => void regenerateMemo()}
                    >
                      {memoBusy ? "Generating…" : "Generate decision memo now"}
                    </Button>
                    {memoError ? (
                      <p className="text-destructive text-sm">{memoError}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No gate or execution data on this run — nothing to feed a
                    memo.
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      ) : null}

      <Separator />

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Script — audit log
        </h2>
        <AuditLog events={audit} />
      </section>
    </div>
  );
}
