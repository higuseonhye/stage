"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ContextGraph } from "@/lib/context-graph";
import { formatContextGraphForBrief } from "@/lib/context-graph";

type Props = {
  onValidated: (params: {
    graph: ContextGraph;
    topic: string;
    userMessage: string;
  }) => void;
  onSkip: () => void;
};

export function ContextLayer(props: Props) {
  const [oneLine, setOneLine] = useState("");
  const [graph, setGraph] = useState<ContextGraph | null>(null);
  const [step, setStep] = useState<"line" | "review">("line");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState(false);

  const infer = async () => {
    const line = oneLine.trim();
    if (!line) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/context/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line }),
        credentials: "include",
      });
      const j = (await res.json()) as { graph?: ContextGraph; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Inference failed");
      if (j.graph) {
        setGraph(j.graph);
        setStep("review");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const refine = async () => {
    if (!graph || !feedback.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/context/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph, feedback: feedback.trim() }),
        credentials: "include",
      });
      const j = (await res.json()) as { graph?: ContextGraph; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Refine failed");
      if (j.graph) {
        setGraph(j.graph);
        setFeedback("");
        setEditing(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const confirm = () => {
    if (!graph) return;
    const topic = oneLine.trim() || graph.idea;
    const userMessage = formatContextGraphForBrief(graph);
    props.onValidated({ graph, topic, userMessage });
  };

  if (step === "line") {
    return (
      <Card className="border-primary/25 bg-primary/5 space-y-4 p-5">
        <div>
          <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Context layer
          </h2>
          <p className="text-foreground mt-1 text-sm font-medium">
            Inference → validation → outcome
          </p>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            One line is enough. The AI structures your situation; you confirm,
            then open the stage.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="one-line">Your idea in one line</Label>
          <Input
            id="one-line"
            value={oneLine}
            onChange={(e) => setOneLine(e.target.value)}
            placeholder="e.g. B2B SaaS to automate inventory for SMBs"
            maxLength={2000}
            className="text-base"
          />
        </div>
        {err ? (
          <p className="text-destructive font-mono text-sm">{err}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={loading || !oneLine.trim()}
            onClick={() => void infer()}
          >
            {loading ? "Understanding…" : "Understand"}
          </Button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
            onClick={props.onSkip}
          >
            Skip — enter topic & brief only
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          What we understood
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Does this look right? Edit below to refine.
        </p>
      </div>
      {graph ? (
        <div className="border-border/60 bg-muted/10 space-y-3 rounded-lg border p-4 text-sm">
          <Row label="Product" value={graph.idea} />
          <Row label="Target" value={graph.target} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground w-28 shrink-0 sm:w-32">
              Stage
            </span>
            <Badge variant="secondary" className="font-mono text-[10px] uppercase">
              {graph.stage}
            </Badge>
          </div>
          <Row label="Market" value={graph.market} />
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <span className="text-muted-foreground w-28 shrink-0 pt-0.5 sm:w-32">
              Competition
            </span>
            <ul className="text-foreground/90 list-inside list-disc space-y-1">
              {graph.competition.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <Row label="Advantage" value={graph.advantage} />
          <Row label="Goal" value={graph.goal} />
        </div>
      ) : null}
      {err ? (
        <p className="text-destructive font-mono text-sm">{err}</p>
      ) : null}

      {editing ? (
        <div className="space-y-2">
          <Label htmlFor="feedback">What should change?</Label>
          <Textarea
            id="feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="e.g. Target is solo creators, not enterprise teams"
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || !feedback.trim()}
              onClick={() => void refine()}
            >
              {loading ? "Applying…" : "Apply"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={confirm} disabled={!graph}>
          Looks good — continue below to open run
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setStep("line");
            setGraph(null);
          }}
        >
          Start over
        </Button>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
      <span className="text-muted-foreground w-28 shrink-0 pt-0.5 sm:w-32">
        {label}
      </span>
      <p className="text-foreground/90 min-w-0 flex-1 leading-relaxed">{value}</p>
    </div>
  );
}
