import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents";
import {
  getDiscussionModel,
  getOpenAIFallbackModel,
  streamAgentTurn,
} from "@/lib/stream";
import { evaluateDiscussionConvergence } from "@/lib/convergence";
import { z } from "zod";

export const maxDuration = 300;

const MAX_DISCUSSION_ROUNDS = 5;

const bodySchema = z.object({
  runId: z.string().uuid(),
});

function buildActionPlan(lastRound: Record<string, string>) {
  const strategist = lastRound.strategist ?? "";
  const executor = lastRound.executor ?? "";
  return `## Proposed action plan (from Strategist)\n\n${strategist}\n\n## Execution checklist (from Executor)\n\n${executor}`;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { runId } = parsed.data;

  const { data: run, error: runError } = await supabase
    .from("runs")
    .select("id, topic, user_message, status, workspace_id")
    .eq("id", runId)
    .maybeSingle();

  if (runError || !run) {
    return new Response("Run not found", { status: 404 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", run.workspace_id)
    .maybeSingle();

  if (!workspace || workspace.owner_id !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  if (run.status !== "discussing") {
    return new Response("Run is not in discussion phase", { status: 409 });
  }

  const { data: existingGate } = await supabase
    .from("approval_gates")
    .select("id")
    .eq("run_id", runId)
    .maybeSingle();

  if (existingGate) {
    return new Response("Discussion already completed for this run", {
      status: 409,
    });
  }

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  let writeChain = Promise.resolve();

  function enqueue(obj: object) {
    const line = `${JSON.stringify(obj)}\n`;
    writeChain = writeChain.then(() => writer.write(encoder.encode(line)));
  }

  void (async () => {
    try {
      await supabase.from("audit_events").insert({
        run_id: runId,
        event_type: "discussion_started",
        payload: { adaptive: true, maxRounds: MAX_DISCUSSION_ROUNDS },
      });

      let priorRound: Record<string, string> = {};
      const allMessages: {
        agent_id: string;
        agent_name: string;
        content: string;
        round: number;
      }[] = [];

      let prevForConvergence: Record<string, string> | null = null;
      let lowScoreStreak = 0;
      let stopReason = "";
      let lastRoundTexts: Record<string, string> = {};
      const refinementByAgent: Record<string, number[]> = Object.fromEntries(
        AGENTS.map((a) => [a.id, [] as number[]]),
      );
      const improvementSeries: number[] = [];

      for (let round = 0; round < MAX_DISCUSSION_ROUNDS; round++) {
        enqueue({
          type: "round_start",
          round: round + 1,
          maxRounds: MAX_DISCUSSION_ROUNDS,
        });

        await Promise.all(
          AGENTS.map(async (agent) => {
            let full = "";
            const tryStream = async (useFallback: boolean) => {
              const model = useFallback
                ? getOpenAIFallbackModel() ?? getDiscussionModel()
                : getDiscussionModel();
              const result = streamAgentTurn({
                agent,
                topic: run.topic,
                userMessage: run.user_message,
                round,
                priorRoundTexts: priorRound,
                model,
              });
              try {
                for await (const part of result.textStream) {
                  full += part;
                  enqueue({
                    type: "token",
                    agentId: agent.id,
                    round,
                    text: part,
                  });
                }
              } catch {
                if (!useFallback && getOpenAIFallbackModel()) {
                  full = "";
                  await tryStream(true);
                } else {
                  throw new Error("Agent stream failed");
                }
              }
            };
            await tryStream(false);

            enqueue({
              type: "agent_round_complete",
              agentId: agent.id,
              round,
              text: full,
            });

            allMessages.push({
              agent_id: agent.id,
              agent_name: agent.name,
              content: full,
              round,
            });
          }),
        );

        const currentRound: Record<string, string> = Object.fromEntries(
          AGENTS.map((a) => {
            const row = allMessages.filter(
              (m) => m.agent_id === a.id && m.round === round,
            );
            const last = row[row.length - 1];
            return [a.id, last?.content ?? ""];
          }),
        );

        lastRoundTexts = { ...currentRound };

        if (prevForConvergence !== null) {
          const conv = await evaluateDiscussionConvergence({
            previousRound: prevForConvergence,
            currentRound,
          });

          improvementSeries.push(conv.improvement);
          for (const a of AGENTS) {
            refinementByAgent[a.id].push(conv.perAgent[a.id] ?? 0);
          }

          enqueue({
            type: "convergence",
            round: round + 1,
            score: conv.improvement,
            criticNewObjections: conv.critic_new_objections,
            strategistNewOptions: conv.strategist_new_options,
            perAgentScores: conv.perAgent,
          });

          if (conv.improvement < 10) {
            lowScoreStreak += 1;
          } else {
            lowScoreStreak = 0;
          }

          if (lowScoreStreak >= 2) {
            stopReason = `Converged at round ${round + 1} — quality stable`;
            break;
          }

          if (
            !conv.critic_new_objections &&
            !conv.strategist_new_options
          ) {
            stopReason = `Converged at round ${round + 1} — panel settled (no new objections or strategic options)`;
            break;
          }
        }

        prevForConvergence = { ...currentRound };
        priorRound = { ...currentRound };

        if (round === MAX_DISCUSSION_ROUNDS - 1) {
          stopReason = `Stopped at round ${MAX_DISCUSSION_ROUNDS} — maximum rounds`;
        }
      }

      if (!stopReason) {
        stopReason = `Stopped at round ${MAX_DISCUSSION_ROUNDS} — maximum rounds`;
      }

      for (const m of allMessages) {
        await supabase.from("agent_messages").insert({
          run_id: runId,
          agent_id: m.agent_id,
          agent_name: m.agent_name,
          content: m.content,
          round: m.round,
        });
        await supabase.from("audit_events").insert({
          run_id: runId,
          event_type: "agent_responded",
          payload: {
            agent_id: m.agent_id,
            round: m.round,
            length: m.content.length,
          },
        });
      }

      const actionPlan = buildActionPlan(lastRoundTexts);

      const { data: gate, error: gateError } = await supabase
        .from("approval_gates")
        .insert({
          run_id: runId,
          action_plan: actionPlan,
          status: "pending",
        })
        .select("id")
        .single();

      if (gateError) throw gateError;

      await supabase
        .from("runs")
        .update({ status: "awaiting_approval" })
        .eq("id", runId);

      await supabase.from("audit_events").insert({
        run_id: runId,
        event_type: "gate_created",
        payload: { gate_id: gate.id },
      });

      const finalRoundNumber =
        allMessages.length === 0
          ? 1
          : Math.max(...allMessages.map((m) => m.round)) + 1;

      enqueue({
        type: "discussion_complete",
        gateId: gate.id,
        criticExcerpt: lastRoundTexts.critic ?? "",
        stopReason,
        finalRound: finalRoundNumber,
        maxRounds: MAX_DISCUSSION_ROUNDS,
        refinementByAgent,
        improvementSeries,
      });
    } catch (e) {
      console.error(e);
      enqueue({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
      await supabase
        .from("runs")
        .update({ status: "failed" })
        .eq("id", runId);
    } finally {
      await writeChain;
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
