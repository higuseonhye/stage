"use client";

import { useCallback, useEffect, useState } from "react";
import { AGENTS } from "@/lib/agents";
import { AgentCard } from "@/components/AgentCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pin, Play } from "lucide-react";

type NdEvent =
  | { type: "token"; agentId: string; round: number; text: string }
  | { type: "agent_round_complete"; agentId: string; round: number; text: string }
  | { type: "discussion_complete"; gateId: string; criticExcerpt: string }
  | { type: "error"; message: string };

type Props = {
  runId: string;
  disabled?: boolean;
  onDiscussionComplete?: (gateId: string, criticExcerpt: string) => void;
};

const PIN_KEY = "stage:pins:";

export function DiscussionPanel({
  runId,
  disabled,
  onDiscussionComplete,
}: Props) {
  const [refine, setRefine] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [textByAgent, setTextByAgent] = useState<Record<string, string>>(() =>
    Object.fromEntries(AGENTS.map((a) => [a.id, ""])),
  );
  const [pins, setPins] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [doneGate, setDoneGate] = useState<string | null>(null);

  const storageKey = `${PIN_KEY}${runId}`;

  const loadPins = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPins(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const persistPins = (next: string[]) => {
    setPins(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const startDiscussion = async () => {
    setError(null);
    setStreaming(true);
    setTextByAgent(Object.fromEntries(AGENTS.map((a) => [a.id, ""])));
    setDoneGate(null);

    try {
      const res = await fetch("/api/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, refineRounds: refine }),
      });

      if (!res.ok || !res.body) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: NdEvent;
          try {
            ev = JSON.parse(line) as NdEvent;
          } catch {
            continue;
          }
          if (ev.type === "token") {
            setTextByAgent((prev) => ({
              ...prev,
              [ev.agentId]: (prev[ev.agentId] ?? "") + ev.text,
            }));
          } else if (ev.type === "discussion_complete") {
            setDoneGate(ev.gateId);
            onDiscussionComplete?.(ev.gateId, ev.criticExcerpt);
          } else if (ev.type === "error") {
            setError(ev.message);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
  };

  const pinSelection = () => {
    const sel = window.getSelection()?.toString().trim();
    if (!sel) return;
    if (pins.includes(sel)) return;
    persistPins([sel, ...pins].slice(0, 24));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="refine"
              checked={refine > 0}
              onCheckedChange={(v) => setRefine(v ? 1 : 0)}
              disabled={streaming || disabled}
            />
            <Label htmlFor="refine" className="text-sm">
              Self-refine (1 extra round)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="refine2"
              checked={refine > 1}
              onCheckedChange={(v) => setRefine(v ? 2 : 1)}
              disabled={streaming || disabled || refine === 0}
            />
            <Label htmlFor="refine2" className="text-muted-foreground text-sm">
              Second refine
            </Label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={pinSelection}
            disabled={streaming}
          >
            <Pin className="mr-1 h-3.5 w-3.5" />
            Pin selection
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={startDiscussion}
            disabled={streaming || disabled}
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            {streaming ? "On stage…" : "Cue the actors"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-destructive font-mono text-sm">{error}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {AGENTS.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            streaming={streaming}
            footer={
              doneGate ? (
                <p className="text-muted-foreground text-[10px]">
                  Round saved — awaiting cue
                </p>
              ) : null
            }
          >
            {textByAgent[agent.id] || (
              <span className="opacity-40">Waiting for spotlight…</span>
            )}
          </AgentCard>
        ))}
      </div>

      {pins.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Pinned insights
          </h4>
          <ul className="space-y-1 font-mono text-xs">
            {pins.map((p) => (
              <li
                key={p}
                className="bg-muted/40 rounded-md border border-border/60 px-2 py-1.5"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
