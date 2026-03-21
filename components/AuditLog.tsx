"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AuditRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const EVENTS = [
  "run_started",
  "discussion_started",
  "agent_responded",
  "gate_created",
  "gate_approved",
  "gate_denied",
  "step_started",
  "step_completed",
  "run_completed",
  "decision_memo_generated",
  "decision_memo_failed",
] as const;

type Props = {
  events: AuditRow[];
};

export function AuditLog({ events }: Props) {
  const [filter, setFilter] = useState<string | "all">("all");

  const rows = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (filter === "all") return sorted;
    return sorted.filter((e) => e.event_type === filter);
  }, [events, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant={filter === "all" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 font-mono text-[10px]"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        {EVENTS.map((ev) => (
          <Button
            key={ev}
            type="button"
            variant={filter === ev ? "secondary" : "ghost"}
            size="sm"
            className="h-7 font-mono text-[10px] uppercase"
            onClick={() => setFilter(ev)}
          >
            {ev.replace(/_/g, " ")}
          </Button>
        ))}
      </div>
      <ul className="max-h-[420px] space-y-2 overflow-y-auto font-mono text-[11px]">
        {rows.map((e) => (
          <li
            key={e.id}
            className="border-border/70 bg-muted/15 rounded-md border px-2 py-2"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[9px] uppercase">
                {e.event_type}
              </Badge>
              <time className="text-muted-foreground text-[10px]">
                {new Date(e.created_at).toLocaleString()}
              </time>
            </div>
            <pre className="text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(e.payload, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
