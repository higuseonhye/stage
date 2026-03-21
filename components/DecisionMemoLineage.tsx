"use client";

import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { latestContentByAgent } from "@/lib/run-messages";
import type { AgentMessageRow, GateRow } from "@/components/RunDetail";
import type { StepRow } from "@/components/ExecutionTimeline";

function clip(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

type Props = {
  topic: string;
  userMessage: string;
  messages: AgentMessageRow[];
  gates: GateRow[];
  steps: StepRow[];
};

/**
 * Explains which artifacts feed `generateDecisionMemoMarkdown` so directors can
 * trace the memo back to discussion, cue, and execution.
 */
export function DecisionMemoLineage({
  topic,
  userMessage,
  messages,
  gates,
  steps,
}: Props) {
  const gate = [...gates].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];

  const latestByAgent = latestContentByAgent(messages);
  const sortedSteps = [...steps].sort((a, b) => a.step_index - b.step_index);

  return (
    <div className="border-border/60 bg-muted/15 text-muted-foreground space-y-4 rounded-lg border p-4 text-sm leading-relaxed">
      <div>
        <h3 className="text-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
          How this memo was built
        </h3>
        <p>
          The memo is a <strong className="text-foreground/90">single synthesis</strong>{" "}
          produced by the performance-tier model (with automatic provider fallback).
          It is instructed to stay faithful to the inputs below — not to invent facts
          beyond them. Further down this page you can read the full discussion
          transcript, cue, and execution in chronological order.
        </p>
      </div>

      <ol className="list-decimal space-y-3 pl-5 marker:text-foreground/50">
        <li>
          <span className="text-foreground/90 font-medium">Topic &amp; director brief</span>
          <p className="mt-1 font-mono text-xs">
            {clip(topic, 220)}
            {userMessage.trim() ? (
              <>
                <br />
                <span className="text-muted-foreground">Brief: </span>
                {clip(userMessage, 280)}
              </>
            ) : null}
          </p>
        </li>
        <li>
          <span className="text-foreground/90 font-medium">
            Panel discussion — last message per actor
          </span>
          <p className="mt-0.5 text-xs">
            Same rule as generation: we take each actor&apos;s{" "}
            <em>latest</em> round from the saved transcript.{" "}
            <Link
              href="#discussion-transcript"
              className="text-primary underline-offset-4 hover:underline"
            >
              Jump to transcript
            </Link>
          </p>
          <ul className="mt-2 space-y-2 border-l border-border/60 pl-3">
            {AGENTS.map((a) => {
              const body = (latestByAgent[a.id] ?? "").trim();
              return (
                <li key={a.id}>
                  <span className="text-foreground/85 font-medium">{a.name}</span>
                  {body ? (
                    <pre className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-snug">
                      {clip(body, 900)}
                    </pre>
                  ) : (
                    <span className="text-muted-foreground/80 ml-1">(empty)</span>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
        <li>
          <span className="text-foreground/90 font-medium">Cue (approval gate)</span>
          {gate ? (
            <>
              <p className="mt-1 text-xs">
                Status:{" "}
                <span className="text-foreground/90 font-mono">{gate.status}</span>
                .{" "}
                <Link
                  href="#cue-approval"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Jump to cue
                </Link>
              </p>
              {gate.human_note?.trim() ? (
                <p className="mt-1 font-mono text-xs">
                  Director note: {clip(gate.human_note, 400)}
                </p>
              ) : (
                <p className="mt-1 text-xs">Director note: (none)</p>
              )}
              <pre className="border-border/50 bg-background/40 mt-2 max-h-40 overflow-y-auto rounded-md border p-2 font-mono text-[11px] whitespace-pre-wrap">
                {clip(gate.action_plan ?? "", 3500)}
              </pre>
            </>
          ) : (
            <p className="mt-1 text-xs">No gate row found for this run.</p>
          )}
        </li>
        <li>
          <span className="text-foreground/90 font-medium">
            Performance pipeline outputs
          </span>
          {sortedSteps.length === 0 ? (
            <p className="mt-1 text-xs">
              No execution steps (e.g. cue denied, or pipeline not run). The memo
              reflects that.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs">
                {sortedSteps.length} step(s).{" "}
                <Link
                  href="#performance-execution"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Jump to execution
                </Link>
              </p>
              <ul className="mt-2 space-y-2">
                {sortedSteps.map((s) => (
                  <li
                    key={s.id}
                    className="border-border/40 rounded-md border bg-background/30 p-2"
                  >
                    <span className="text-foreground/85 font-mono text-xs">
                      Step {s.step_index + 1} · {s.agent_id}
                    </span>
                    <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-[11px]">
                      {clip(s.output ?? "", 1200)}
                    </pre>
                  </li>
                ))}
              </ul>
            </>
          )}
        </li>
      </ol>
    </div>
  );
}
