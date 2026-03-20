"use client";

import { Card } from "@/components/ui/card";
import { AGENT_COLOR_CLASSES, type AgentDefinition } from "@/lib/agents";
import { atAGlanceSummary } from "@/lib/text-snippets";
import { cn } from "@/lib/utils";

type Props = {
  agent: AgentDefinition;
  streaming?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Latest round improvement score (0–100) from convergence */
  improvementDelta?: number | null;
  /** Raw text for an at-a-glance summary (first ~380 chars) */
  plainTextForSummary?: string;
};

export function AgentCard({
  agent,
  streaming,
  children,
  footer,
  improvementDelta,
  plainTextForSummary,
}: Props) {
  const c = AGENT_COLOR_CLASSES[agent.color];
  const glance =
    plainTextForSummary && plainTextForSummary.trim().length > 160
      ? atAGlanceSummary(plainTextForSummary, 320)
      : null;

  return (
    <Card
      className={cn(
        "flex max-h-[min(420px,52vh)] min-h-[200px] flex-col overflow-hidden border-2 bg-card/40 p-3 shadow-none backdrop-blur-sm",
        c.border,
        streaming && "ring-2",
        streaming && c.ring,
      )}
    >
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-sm font-semibold",
            c.bg,
            c.text,
          )}
          aria-hidden
        >
          {agent.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium leading-tight">{agent.name}</h3>
            {improvementDelta != null ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums",
                  improvementDelta >= 40 &&
                    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200",
                  improvementDelta >= 15 &&
                    improvementDelta < 40 &&
                    "bg-amber-500/20 text-amber-800 dark:text-amber-100",
                  improvementDelta < 15 &&
                    "bg-muted text-muted-foreground",
                )}
                title="Improvement vs previous round (0–100)"
              >
                +{improvementDelta}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs leading-snug">
            {agent.role}
          </p>
        </div>
      </div>
      {glance ? (
        <details className="border-border/50 mb-2 shrink-0 rounded-md border bg-muted/20 px-2 py-1.5">
          <summary className="cursor-pointer font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            At a glance
          </summary>
          <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
            {glance}
          </p>
        </details>
      ) : null}
      <div className="text-muted-foreground min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain font-mono text-xs leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
        {children}
      </div>
      {footer ? (
        <div className="mt-2 shrink-0 border-t border-border/60 pt-2">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
