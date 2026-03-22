"use client";

import { useCallback, useEffect, useState } from "react";
import { AGENTS } from "@/lib/agents";
import { AgentCard } from "@/components/AgentCard";
import { Button } from "@/components/ui/button";
import { Pin, Play } from "lucide-react";

type NdEvent =
  | {
      type: "token";
      agentId: string;
      round: number;
      phase?: string;
      text: string;
    }
  | {
      type: "agent_round_complete";
      agentId: string;
      round: number;
      phase?: string;
      text: string;
    }
  | {
      type: "round_start";
      round: number;
      maxRounds: number;
      phase?: string;
      label?: string;
    }
  | { type: "synthesis_start" }
  | { type: "synthesis_token"; text: string }
  | { type: "synthesis_complete"; text: string }
  | {
      type: "discussion_complete";
      gateId: string;
      criticExcerpt: string;
      synthesisExcerpt?: string;
      stopReason: string;
      summaryLabel?: string;
      finalRound: number;
      maxRounds: number;
    }
  | { type: "error"; message: string };

type Props = {
  runId: string;
  disabled?: boolean;
  persistedTexts?: Record<string, string>;
  onDiscussionComplete?: (
    gateId: string,
    criticExcerpt: string,
    synthesisExcerpt?: string,
  ) => void;
};

const PIN_KEY = "stage:pins:";

const emptyAgentMap = () =>
  Object.fromEntries(AGENTS.map((a) => [a.id, ""])) as Record<string, string>;

export function DiscussionPanel({
  runId,
  disabled,
  persistedTexts = {},
  onDiscussionComplete,
}: Props) {
  const [streaming, setStreaming] = useState(false);
  const [textByAgent, setTextByAgent] = useState<Record<string, string>>(
    () => emptyAgentMap(),
  );
  const [pins, setPins] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [doneGate, setDoneGate] = useState<string | null>(null);
  const [roundLabel, setRoundLabel] = useState<string | null>(null);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [synthesisText, setSynthesisText] = useState("");

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
    setTextByAgent(emptyAgentMap());
    setDoneGate(null);
    setStopReason(null);
    setRoundLabel(null);
    setSynthesisText("");

    try {
      const res = await fetch("/api/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      if (!res.ok || !res.body) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleEvent = (ev: NdEvent) => {
        if (ev.type === "token") {
          setTextByAgent((prev) => ({
            ...prev,
            [ev.agentId]: (prev[ev.agentId] ?? "") + ev.text,
          }));
        } else if (ev.type === "agent_round_complete") {
          setTextByAgent((prev) => ({
            ...prev,
            [ev.agentId]: ev.text,
          }));
        } else if (ev.type === "round_start") {
          setRoundLabel(
            ev.label ??
              `Round ${ev.round} / ${ev.maxRounds}`,
          );
          setTextByAgent(emptyAgentMap());
        } else if (ev.type === "synthesis_start") {
          setSynthesisText("");
          setRoundLabel("Synthesis — neutral summary");
        } else if (ev.type === "synthesis_token") {
          setSynthesisText((prev) => prev + ev.text);
        } else if (ev.type === "synthesis_complete") {
          setSynthesisText(ev.text);
        } else if (ev.type === "discussion_complete") {
          setDoneGate(ev.gateId);
          setStopReason(ev.stopReason);
          setRoundLabel(
            ev.summaryLabel ??
              `Round ${ev.finalRound} / max ${ev.maxRounds}`,
          );
          onDiscussionComplete?.(
            ev.gateId,
            ev.criticExcerpt,
            ev.synthesisExcerpt,
          );
        } else if (ev.type === "error") {
          setError(ev.message);
        }
      };

      const consumeBufferLines = () => {
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            handleEvent(JSON.parse(line) as NdEvent);
          } catch {
            /* skip malformed line */
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        consumeBufferLines();
        if (done) break;
      }

      if (buffer.trim()) {
        try {
          handleEvent(JSON.parse(buffer) as NdEvent);
        } catch {
          /* trailing fragment */
        }
        buffer = "";
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
        <div className="text-muted-foreground min-h-[1.25rem] font-mono text-xs">
          {streaming || roundLabel ? (
            <span>{roundLabel ?? "Starting…"}</span>
          ) : null}
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

      {stopReason ? (
        <p className="text-muted-foreground border-border/60 rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs leading-relaxed">
          {stopReason}
        </p>
      ) : null}

      {error ? (
        <p className="text-destructive font-mono text-sm">{error}</p>
      ) : null}

      <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
        {AGENTS.map((agent) => {
          const live = textByAgent[agent.id] ?? "";
          const saved = persistedTexts[agent.id] ?? "";
          const text = live || saved;
          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              streaming={streaming}
              plainTextForSummary={text || undefined}
              footer={
                doneGate ? (
                  <p className="text-muted-foreground text-[10px]">
                    Round saved — awaiting cue
                  </p>
                ) : null
              }
            >
              {text ? (
                text
              ) : (
                <span className="opacity-40">Waiting for spotlight…</span>
              )}
            </AgentCard>
          );
        })}
      </div>

      {synthesisText ? (
        <div className="border-border/60 bg-muted/15 rounded-lg border p-4">
          <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Synthesis — for the Director (before cue)
          </h3>
          <pre className="text-muted-foreground max-h-[min(320px,50vh)] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
            {synthesisText}
          </pre>
        </div>
      ) : null}

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
