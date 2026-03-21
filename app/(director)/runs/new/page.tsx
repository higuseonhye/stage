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
import { ContextLayer } from "@/components/ContextLayer";
import type { ContextGraph } from "@/lib/context-graph";
import { initialSnapshotFromGraph } from "@/lib/context-graph";
const defaultExample = STAGE_EXAMPLES.find((e) => e.id === DEFAULT_EXAMPLE_ID)!;

type ApiProject = {
  id: string;
  name: string;
  goal: string | null;
  context_snapshot: Record<string, unknown> | null;
  created_at: string;
};

const CREATE_PROJECT_VALUE = "__create__";

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

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectGoal, setNewProjectGoal] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  /** infer → validate → then run form */
  const [contextStep, setContextStep] = useState<"gate" | "form">("gate");
  const [savedContextGraph, setSavedContextGraph] =
    useState<ContextGraph | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/projects", { credentials: "include" });
        if (!res.ok) return;
        const j = (await res.json()) as { projects?: ApiProject[] };
        if (!cancelled && j.projects) setProjects(j.projects);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (projectId !== CREATE_PROJECT_VALUE || !savedContextGraph) return;
    setNewProjectName((prev) =>
      prev.trim() ? prev : savedContextGraph.idea.slice(0, 200),
    );
  }, [projectId, savedContextGraph]);

  const applyExample = (id: string) => {
    const ex = STAGE_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setContextStep("form");
    setSavedContextGraph(null);
    setSelectedExampleId(id);
    setTopic(ex.topic);
    setUserMessage(ex.brief);
  };

  const showFirstHireMemoLink =
    selectedExampleId === FIRST_HIRE_EXAMPLE_ID ||
    isFirstHireExampleContent(topic, userMessage);

  const selectedProject = projects.find((p) => p.id === projectId);
  const snapshot = selectedProject?.context_snapshot;
  const hasContextPreview =
    snapshot &&
    typeof snapshot === "object" &&
    !Array.isArray(snapshot) &&
    Object.keys(snapshot).length > 0;

  const createProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setCreatingProject(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          goal: newProjectGoal.trim() || undefined,
          ...(savedContextGraph
            ? { contextGraph: savedContextGraph }
            : {}),
        }),
        credentials: "include",
      });
      const j = (await res.json()) as {
        id?: string;
        error?: unknown;
        hint?: string;
      };
      if (!res.ok) {
        const base =
          typeof j.error === "string"
            ? j.error
            : typeof j.error === "object" && j.error !== null
              ? JSON.stringify(j.error)
              : "Could not create project";
        const hint = typeof j.hint === "string" ? `\n${j.hint}` : "";
        throw new Error(`${base}${hint}`);
      }
      if (j.id) {
        const row: ApiProject = {
          id: j.id,
          name,
          goal: newProjectGoal.trim() || null,
          context_snapshot: savedContextGraph
            ? initialSnapshotFromGraph(savedContextGraph)
            : {},
          created_at: new Date().toISOString(),
        };
        setProjects((prev) => [row, ...prev]);
        setProjectId(j.id);
        setNewProjectName("");
        setNewProjectGoal("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingProject(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (projectId === CREATE_PROJECT_VALUE) {
      setErr('Finish creating a project (name + "Create project") or choose another option.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          userMessage,
          ...(projectId ? { projectId } : {}),
          ...(savedContextGraph && projectId
            ? { contextGraph: savedContextGraph }
            : {}),
        }),
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
        Context-aware decision flow: minimal input → structured understanding →
        validation → then the stage (discussion, cue, performance).
      </p>

      {contextStep === "gate" ? (
        <div className="mb-10 space-y-4">
          <ContextLayer
            onValidated={({ graph, topic: t, userMessage: um }) => {
              setTopic(t);
              setUserMessage(um);
              setSavedContextGraph(graph);
              setSelectedExampleId("");
              setContextStep("form");
            }}
            onSkip={() => setContextStep("form")}
          />
        </div>
      ) : null}

      {contextStep === "form" ? (
        <>
          {savedContextGraph ? (
            <details className="border-border/60 bg-muted/10 mb-6 rounded-lg border">
              <summary className="cursor-pointer px-3 py-2 font-mono text-xs tracking-wide text-foreground/90 uppercase">
                Validated context graph (AI-filled)
              </summary>
              <pre className="text-muted-foreground max-h-48 overflow-auto border-t px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(savedContextGraph, null, 2)}
              </pre>
            </details>
          ) : null}
          <p className="text-muted-foreground mb-4 text-xs">
            <button
              type="button"
              className="text-primary font-medium underline-offset-4 hover:underline"
              onClick={() => {
                setContextStep("gate");
                setSavedContextGraph(null);
              }}
            >
              ← Back to context layer
            </button>
          </p>
      <section className="border-border/60 bg-card/20 mb-8 space-y-4 rounded-xl border p-4">
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Project
        </h2>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Link this run to a project so discussion agents see accumulated
          context. Context updates after each completed performance pipeline.
        </p>
        <div className="space-y-2">
          <Label htmlFor="project">Select or create</Label>
          <select
            id="project"
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            value={projectId === CREATE_PROJECT_VALUE ? CREATE_PROJECT_VALUE : projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value={CREATE_PROJECT_VALUE}>+ New project…</option>
          </select>
        </div>
        {projectId === CREATE_PROJECT_VALUE ? (
          <div className="space-y-3 rounded-lg border border-dashed p-3">
            <div className="space-y-2">
              <Label htmlFor="np-name">New project name</Label>
              <Input
                id="np-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Q3 retention initiative"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-goal">Project goal (optional)</Label>
              <Textarea
                id="np-goal"
                value={newProjectGoal}
                onChange={(e) => setNewProjectGoal(e.target.value)}
                placeholder="Longer-term north star for this project…"
                rows={3}
                maxLength={8000}
                className="font-mono text-sm"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={creatingProject || !newProjectName.trim()}
              onClick={() => void createProject()}
            >
              {creatingProject ? "Creating…" : "Create project"}
            </Button>
          </div>
        ) : null}
        {projectId &&
        projectId !== CREATE_PROJECT_VALUE &&
        hasContextPreview ? (
          <details className="border-border/60 bg-muted/15 rounded-lg border">
            <summary className="cursor-pointer px-3 py-2 font-mono text-xs tracking-wide text-foreground/90 uppercase">
              What we know so far (context snapshot)
            </summary>
            <pre className="text-muted-foreground max-h-64 overflow-auto border-t px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </details>
        ) : null}
        {projectId &&
        projectId !== CREATE_PROJECT_VALUE &&
        !hasContextPreview ? (
          <p className="text-muted-foreground font-mono text-xs">
            No accumulated context yet — it will build after you complete
            performance runs under this project.
          </p>
        ) : null}
      </section>

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
          in the top nav as{" "}
          <span className="text-foreground/80">Memo template</span> (blank only;
          generated memos are on each completed run).
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
        </>
      ) : null}
    </div>
  );
}
