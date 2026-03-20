"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { agentById } from "@/lib/agents";
import { AGENT_COLOR_CLASSES } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { atAGlanceSummary } from "@/lib/text-snippets";

export type StepRow = {
  id: string;
  step_index: number;
  agent_id: string;
  input: string;
  output: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
};

type Props = {
  runId: string;
  steps: StepRow[];
};

function durationMs(s: StepRow) {
  if (!s.started_at || !s.finished_at) return null;
  return (
    new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()
  );
}

export function ExecutionTimeline({ runId, steps }: Props) {
  const [retrying, setRetrying] = useState<string | null>(null);

  const sorted = [...steps].sort((a, b) => a.step_index - b.step_index);

  const retry = async (stepId: string) => {
    setRetrying(stepId);
    try {
      await fetch(`/api/runs/${runId}/retry-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
    } finally {
      setRetrying(null);
    }
  };

  if (!sorted.length) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        No performance steps yet — approve a cue to enqueue the pipeline.
      </p>
    );
  }

  return (
    <div className="relative space-y-0 pl-2">
      <div className="bg-border absolute top-2 bottom-2 left-[11px] w-px" aria-hidden />
      <ul className="space-y-4">
        {sorted.map((s) => {
          const agent = agentById(s.agent_id);
          const colors = agent
            ? AGENT_COLOR_CLASSES[agent.color]
            : AGENT_COLOR_CLASSES.blue;
          const ms = durationMs(s);
          return (
            <li key={s.id} className="relative flex gap-3 pl-6">
              <span
                className={cn(
                  "absolute left-0 top-3 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                  s.status === "done" && "bg-emerald-500",
                  s.status === "running" && "bg-sky-400 animate-pulse",
                  s.status === "queued" && "bg-zinc-500",
                  s.status === "failed" && "bg-red-500",
                )}
                aria-hidden
              />
              <Card className="min-w-0 flex-1 border-border/80 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("font-mono text-[10px]", colors.text)}>
                    Step {s.step_index + 1}
                  </Badge>
                  <span className="text-sm font-medium">
                    {agent?.name ?? s.agent_id}
                  </span>
                  <Badge
                    variant={
                      s.status === "failed"
                        ? "destructive"
                        : s.status === "done"
                          ? "secondary"
                          : "outline"
                    }
                    className="ml-auto font-mono text-[10px] uppercase"
                  >
                    {s.status}
                  </Badge>
                </div>
                {ms != null ? (
                  <p className="text-muted-foreground mb-2 font-mono text-[10px]">
                    {ms} ms
                  </p>
                ) : null}
                <div className="space-y-2">
                  <div>
                    <h4 className="text-muted-foreground mb-0.5 text-[10px] uppercase">
                      Input
                    </h4>
                    {s.input.length > 200 ? (
                      <p className="text-muted-foreground mb-1 text-[11px] leading-snug">
                        <span className="text-foreground/75 font-medium">Skim: </span>
                        {atAGlanceSummary(s.input, 260)}
                      </p>
                    ) : null}
                    <pre className="bg-muted/25 max-h-[min(200px,32vh)] overflow-y-auto rounded border border-border/60 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                      {s.input}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-muted-foreground mb-0.5 text-[10px] uppercase">
                      Output
                    </h4>
                    {s.output && s.output.length > 200 ? (
                      <p className="text-muted-foreground mb-1 text-[11px] leading-snug">
                        <span className="text-foreground/75 font-medium">Skim: </span>
                        {atAGlanceSummary(s.output, 260)}
                      </p>
                    ) : null}
                    <pre className="bg-muted/25 max-h-[min(280px,40vh)] overflow-y-auto rounded border border-border/60 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                      {s.output || "—"}
                    </pre>
                  </div>
                </div>
                {s.status === "failed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={retrying === s.id}
                    onClick={() => retry(s.id)}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Retry step
                  </Button>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
