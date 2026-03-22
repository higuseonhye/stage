"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { DiscussionPanel } from "@/components/DiscussionPanel";
import { ApprovalGate } from "@/components/ApprovalGate";
import { MemoMarkdown } from "@/components/MemoMarkdown";
import { ExecutionTimeline, type StepRow } from "@/components/ExecutionTimeline";
import { AuditLog, type AuditRow } from "@/components/AuditLog";
import { DecisionMemoLineage } from "@/components/DecisionMemoLineage";

const DecisionMemoExport = dynamic(
  () =>
    import("@/components/DecisionMemoExport").then((mod) => ({
      default: mod.DecisionMemoExport,
    })),
  { ssr: false },
);
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  latestContentByAgent,
  latestCriticContent,
} from "@/lib/run-messages";

function formatUtcTimestamp(iso: string) {
  try {
    return (
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(iso)) + " UTC"
    );
  } catch {
    return iso;
  }
}

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
  debate_phase?: string | null;
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
  /** Linked project name when run was created under a project */
  projectName?: string | null;
  initialRun: RunRow;
  initialMessages: AgentMessageRow[];
  initialGates: GateRow[];
  initialSteps: StepRow[];
  initialAudit: AuditRow[];
};

export function RunDetail({
  runId,
  projectName,
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
  const [liveSynthesisExcerpt, setLiveSynthesisExcerpt] = useState("");
  const [memoBusy, setMemoBusy] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);
  const memoPrintRef = useRef<HTMLDivElement>(null);

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

  const synthesisFromMessages = useMemo(() => {
    const syn = messages.filter((m) => m.agent_id === "synthesis");
    if (!syn.length) return "";
    syn.sort(
      (a, b) =>
        b.round - a.round ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return syn[0]?.content ?? "";
  }, [messages]);

  const synthesisForGate = liveSynthesisExcerpt || synthesisFromMessages;

  /** Latest successful memo write from audit (covers regenerate). */
  const decisionMemoGeneratedAt = useMemo(() => {
    const rows = audit.filter((e) => e.event_type === "decision_memo_generated");
    if (rows.length === 0) return null;
    return rows.reduce((latest, e) =>
      new Date(e.created_at) > new Date(latest.created_at) ? e : latest,
    ).created_at;
  }, [audit]);

  useEffect(() => {
    setLiveSynthesisExcerpt("");
  }, [runId]);

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
          {projectName ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Project:{" "}
              <span className="text-foreground/90 font-medium">{projectName}</span>
            </p>
          ) : null}
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

      {run.status === "completed" ? (
        <div
          className={
            run.decision_memo_markdown?.trim()
              ? "border-primary/35 bg-primary/[0.06] rounded-xl border px-4 py-3"
              : "border-border/70 bg-muted/20 rounded-xl border border-dashed px-4 py-3"
          }
        >
          <p className="text-foreground text-sm font-medium">
            {run.decision_memo_markdown?.trim()
              ? "Final deliverable ready"
              : "Run finished — decision memo missing"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {run.decision_memo_markdown?.trim() ? (
              <>
                Your <strong>AI decision memo</strong> is the first section on
                this page (saved on this run in the database). The top nav{" "}
                <strong>Memo template</strong> link is only a{" "}
                <strong>blank printable</strong> — it does not load your run.
              </>
            ) : (
              <>
                Generation may have failed or the run predates memo storage. Use
                &quot;Generate decision memo now&quot; below, or check the audit
                log for <code className="text-foreground/80">decision_memo_failed</code>.
              </>
            )}
          </p>
        </div>
      ) : null}

      {run.status === "completed" ? (
        <>
          <section
            id="decision-memo-final"
            className="border-primary/25 from-primary/[0.04] scroll-mt-24 space-y-4 rounded-xl border bg-gradient-to-b to-transparent p-1"
          >
            <div className="px-1 pt-1">
              <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
                Final output — Decision memo
              </h2>
              <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
                Stored on this run as{" "}
                <code className="text-foreground/85 text-xs">
                  runs.decision_memo_markdown
                </code>
                . Generated when the run completes (approve + performance, or
                deny at cue) using the performance-tier model chain. For a blank
                paper form, use nav{" "}
                <Link
                  href="/resources/decision-memo"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Memo template
                </Link>
                .
              </p>
            </div>

            <DecisionMemoLineage
              topic={run.topic}
              userMessage={run.user_message}
              messages={messages}
              gates={gates}
              steps={steps}
            />

            {run.decision_memo_markdown?.trim() ? (
              <div className="border-border/60 bg-card/40 rounded-lg border p-4">
                <div className="mb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Generated memo
                    </p>
                    <DecisionMemoExport
                      markdown={run.decision_memo_markdown}
                      topic={run.topic}
                      printRef={memoPrintRef}
                    />
                  </div>
                  {decisionMemoGeneratedAt ? (
                    <p className="text-muted-foreground mt-1.5 font-mono text-[11px] leading-relaxed">
                      Last recorded{" "}
                      <time dateTime={decisionMemoGeneratedAt}>
                        {formatUtcTimestamp(decisionMemoGeneratedAt)}
                      </time>{" "}
                      · audit{" "}
                      <code className="text-foreground/85">decision_memo_generated</code>
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1.5 font-mono text-[11px]">
                      No <code className="text-foreground/85">decision_memo_generated</code>{" "}
                      event in audit (older run or logged before this event existed).
                    </p>
                  )}
                </div>
                <div
                  ref={memoPrintRef}
                  className="max-h-[min(70vh,720px)] overflow-y-auto rounded-md border border-border/50 bg-background/60 p-4 shadow-inner"
                >
                  <MemoMarkdown source={run.decision_memo_markdown} />
                </div>
              </div>
            ) : (
              <div className="space-y-3 px-1 pb-2">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  No generated memo stored yet. Common cases: this run finished
                  before the memo column existed, generation failed (see{" "}
                  <code className="text-foreground/80">decision_memo_failed</code>{" "}
                  in the audit log), or the pipeline has not finished writing.
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
          <Separator />
        </>
      ) : null}

      <section id="discussion-transcript" className="scroll-mt-24 space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Stage — discussion
        </h2>
        <DiscussionPanel
          runId={runId}
          disabled={discussDisabled}
          persistedTexts={persistedAgentTexts}
          onDiscussionComplete={(_, critic, synthesis) => {
            setCriticExcerpt(critic);
            if (synthesis?.trim()) setLiveSynthesisExcerpt(synthesis);
            void refresh();
          }}
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
                    {m.debate_phase
                      ? `${m.debate_phase} · R${m.round}`
                      : `R${m.round}`}{" "}
                    · {m.agent_name}
                  </span>
                  <pre className="mt-1 whitespace-pre-wrap">{m.content}</pre>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <Separator />

      <section id="cue-approval" className="scroll-mt-24 space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Cue — approval gate
        </h2>
        <ApprovalGate
          gate={pendingGate}
          criticExcerpt={criticExcerpt || criticFromMessages}
          synthesisExcerpt={synthesisForGate || undefined}
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

      <section id="performance-execution" className="scroll-mt-24 space-y-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Performance — execution
        </h2>
        <ExecutionTimeline runId={runId} steps={steps} />
      </section>

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
