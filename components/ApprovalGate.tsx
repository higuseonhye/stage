"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Check, Pencil, X } from "lucide-react";
import { atAGlanceSummary, extractSectionHeadings } from "@/lib/text-snippets";

type Gate = {
  id: string;
  action_plan: string;
  status: string;
  created_at: string;
  human_note: string | null;
};

type Props = {
  gate: Gate | null;
  criticExcerpt: string;
  /** Neutral debate summary — read before cue when present */
  synthesisExcerpt?: string;
  runId: string;
  onDecided?: () => void;
};

export function ApprovalGate({
  gate,
  criticExcerpt,
  synthesisExcerpt,
  runId,
  onDecided,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [edited, setEdited] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waitSec, setWaitSec] = useState(0);

  useEffect(() => {
    if (!gate || gate.status !== "pending") return;
    const start = new Date(gate.created_at).getTime();
    const tick = () =>
      setWaitSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gate]);

  useEffect(() => {
    if (gate) setEdited(gate.action_plan);
  }, [gate]);

  if (!gate || gate.status !== "pending") {
    return null;
  }

  const planGlance = atAGlanceSummary(gate.action_plan, 420);
  const planHeads = extractSectionHeadings(gate.action_plan, 10);
  const criticGlance = criticExcerpt
    ? atAGlanceSummary(criticExcerpt, 280)
    : "";

  const synthesisGlance = synthesisExcerpt?.trim()
    ? atAGlanceSummary(synthesisExcerpt, 320)
    : "";

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  };

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      onDecided?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-3xl overflow-visible border-2 border-orange-500/55 bg-card/80 p-6 shadow-lg ring-2 ring-orange-500/25">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Cue — approval</h2>
          <p className="text-muted-foreground text-sm">
            The performance pauses until you approve, deny, or edit the action
            plan.
          </p>
        </div>
        <div className="font-mono text-xs text-orange-300/90">
          Waiting {fmt(waitSec)}
        </div>
      </div>

      {synthesisExcerpt?.trim() ? (
        <div className="mb-4 rounded-md border border-sky-500/40 bg-sky-500/5 p-3">
          <h3 className="mb-1 text-xs font-medium tracking-wide text-sky-200/90 uppercase">
            Synthesis — read before cue
          </h3>
          {synthesisGlance &&
          synthesisGlance.length < synthesisExcerpt.trim().length ? (
            <p className="mb-2 text-xs leading-snug text-sky-100/90">
              <span className="font-medium text-sky-200/95">Skim: </span>
              {synthesisGlance}
            </p>
          ) : null}
          <div className="max-h-[min(220px,30vh)] overflow-y-auto rounded border border-sky-500/25 bg-sky-950/10 p-2">
            <p className="font-mono text-xs leading-relaxed text-sky-100/85 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {synthesisExcerpt.trim()}
            </p>
          </div>
        </div>
      ) : null}

      {criticExcerpt ? (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <h3 className="mb-1 text-xs font-medium tracking-wide text-amber-200/90 uppercase">
            Critic — risk lens
          </h3>
          {criticGlance && criticGlance.length < criticExcerpt.length ? (
            <p className="mb-2 text-xs leading-snug text-amber-100/90">
              <span className="font-medium text-amber-200/95">Skim: </span>
              {criticGlance}
            </p>
          ) : null}
          <div className="max-h-[min(200px,28vh)] overflow-y-auto rounded border border-amber-500/25 bg-amber-950/10 p-2">
            <p className="font-mono text-xs leading-relaxed text-amber-100/85 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {criticExcerpt}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4">
        <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Proposed action plan
        </h3>
        {!editOpen && planHeads.length > 0 ? (
          <div className="text-muted-foreground mb-2 rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-xs">
            <span className="font-medium text-foreground/80">Outline: </span>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {planHeads.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!editOpen && planGlance && planGlance.length < gate.action_plan.length ? (
          <p className="text-muted-foreground mb-2 text-xs leading-relaxed">
            <span className="text-foreground/80 font-medium">At a glance: </span>
            {planGlance}
          </p>
        ) : null}
        {editOpen ? (
          <Textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            className="min-h-[200px] font-mono text-xs"
          />
        ) : (
          <div className="bg-muted/30 max-h-[min(55vh,520px)] overflow-y-auto rounded-md border border-border/80 p-3">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {gate.action_plan}
            </pre>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="text-muted-foreground mb-1 block text-xs uppercase">
          Director note (optional)
        </label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Context for the script / audit log"
          className="font-mono text-xs"
          rows={2}
        />
      </div>

      {err ? (
        <p className="text-destructive mb-3 font-mono text-sm">{err}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={busy}
          onClick={() =>
            post({
              gateId: gate.id,
              decision: "approve",
              humanNote: note || null,
            })
          }
        >
          <Check className="mr-1 h-4 w-4" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() =>
            post({
              gateId: gate.id,
              decision: "deny",
              humanNote: note || null,
            })
          }
        >
          <X className="mr-1 h-4 w-4" />
          Deny
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => setEditOpen((v) => !v)}
        >
          <Pencil className="mr-1 h-4 w-4" />
          {editOpen ? "Preview" : "Edit & approve"}
        </Button>
        {editOpen ? (
          <Button
            size="sm"
            disabled={busy || !edited.trim()}
            onClick={() =>
              post({
                gateId: gate.id,
                decision: "edit_approve",
                editedPlan: edited,
                humanNote: note || null,
              })
            }
          >
            Save edit & approve
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground mt-3 font-mono text-[10px]">
        Run {runId.slice(0, 8)}… — execution starts only after approval.
      </p>
    </Card>
  );
}
