"use client";

import { Card } from "@/components/ui/card";
import { AGENT_COLOR_CLASSES, type AgentDefinition } from "@/lib/agents";
import { cn } from "@/lib/utils";

type Props = {
  agent: AgentDefinition;
  streaming?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AgentCard({ agent, streaming, children, footer }: Props) {
  const c = AGENT_COLOR_CLASSES[agent.color];
  return (
    <Card
      className={cn(
        "flex min-h-[220px] flex-col overflow-visible border-2 bg-card/40 p-3 shadow-none backdrop-blur-sm",
        c.border,
        streaming && "ring-2",
        streaming && c.ring,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
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
        <div>
          <h3 className="text-sm font-medium leading-tight">{agent.name}</h3>
          <p className="text-muted-foreground text-xs leading-snug">
            {agent.role}
          </p>
        </div>
      </div>
      <div className="text-muted-foreground w-full min-w-0 shrink-0 break-words font-mono text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        {children}
      </div>
      {footer ? <div className="mt-2 border-t border-border/60 pt-2">{footer}</div> : null}
    </Card>
  );
}
