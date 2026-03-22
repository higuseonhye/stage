import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents";
import { getDiscussionModelsOrdered } from "@/lib/model-fallback";
import {
  collectStreamedAssistantText,
  streamDebateAgentTurn,
  streamSynthesis,
  type DebatePhase,
} from "@/lib/stream";
import { z } from "zod";
import {
  RateLimitExceededError,
  enforceDiscussRateLimit,
} from "@/lib/rate-limit";
import { userHasWorkspaceAccess } from "@/lib/workspace-access";

export const maxDuration = 300;

const DEBATE_PHASES: { phase: DebatePhase; label: string; debatePhase: string }[] =
  [
    { phase: "position", label: "Round 1 — Position", debatePhase: "position" },
    { phase: "attack", label: "Round 2 — Attack", debatePhase: "attack" },
    { phase: "defense", label: "Round 3 — Defend", debatePhase: "defense" },
  ];

const bodySchema = z.object({
  runId: z.string().uuid(),
});

function buildActionPlanForCue(params: {
  synthesis: string;
  defenseRound: Record<string, string>;
}) {
  const synthesis = params.synthesis.trim();
  const strategist = (params.defenseRound.strategist ?? "").trim();
  const executor = (params.defenseRound.executor ?? "").trim();
  return `## Synthesis (neutral summary for the Director)\n\n${synthesis}\n\n---\n\n## Strategist — Round 3 defense\n\n${strategist || "(empty)"}\n\n---\n\n## Executor — Round 3 defense\n\n${executor || "(empty)"}`;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await enforceDiscussRateLimit(request, user.id);
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return new Response(e.message, { status: 429 });
    }
    throw e;
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
    .select("id, topic, user_message, status, workspace_id, project_id")
    .eq("id", runId)
    .maybeSingle();

  if (runError || !run) {
    return new Response("Run not found", { status: 404 });
  }

  const canAccess = await userHasWorkspaceAccess(
    supabase,
    user.id,
    run.workspace_id,
  );
  if (!canAccess) {
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
      let systemPrefix = "";
      if (run.project_id) {
        const { data: project } = await supabase
          .from("projects")
          .select("context_snapshot")
          .eq("id", run.project_id)
          .maybeSingle();
        const snap = project?.context_snapshot;
        if (
          snap &&
          typeof snap === "object" &&
          !Array.isArray(snap) &&
          Object.keys(snap as object).length > 0
        ) {
          systemPrefix = `## Accumulated project context\n${JSON.stringify(snap, null, 2)}\n\n`;
        }
      }

      await supabase.from("audit_events").insert({
        run_id: runId,
        event_type: "discussion_started",
        payload: {
          structure: "debate_v1",
          rounds: DEBATE_PHASES.length,
          synthesis: true,
        },
      });

      const allMessages: {
        agent_id: string;
        agent_name: string;
        content: string;
        round: number;
        debate_phase: string;
      }[] = [];

      let round1: Record<string, string> = {};
      let round2: Record<string, string> = {};
      let round3: Record<string, string> = {};

      for (let phaseIndex = 0; phaseIndex < DEBATE_PHASES.length; phaseIndex++) {
        const { phase, label, debatePhase } = DEBATE_PHASES[phaseIndex];
        enqueue({
          type: "round_start",
          round: phaseIndex + 1,
          maxRounds: DEBATE_PHASES.length,
          phase,
          label,
        });

        const phaseOutputs: Record<string, string> = {};

        for (const agent of AGENTS) {
          let full = "";
          const models = getDiscussionModelsOrdered();
          if (models.length === 0) {
            throw new Error(
              "No AI providers configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY.",
            );
          }
          for (let mi = 0; mi < models.length; mi++) {
            try {
              const result = streamDebateAgentTurn({
                agent,
                topic: run.topic,
                userMessage: run.user_message,
                phase,
                round1ByAgent: round1,
                round2ByAgent: phase === "defense" ? round2 : undefined,
                model: models[mi],
                systemPrefix: systemPrefix || undefined,
              });
              full = await collectStreamedAssistantText(result, (chunk) => {
                enqueue({
                  type: "token",
                  agentId: agent.id,
                  round: phaseIndex,
                  phase,
                  text: chunk,
                });
              });
              if (!full.trim()) {
                throw new Error("Empty model response");
              }
              break;
            } catch (e) {
              if (mi < models.length - 1) {
                console.warn(
                  `[ai] discuss stream fallback ${mi + 1}→${mi + 2}/${models.length}:`,
                  e instanceof Error ? e.message : e,
                );
                continue;
              }
              throw e instanceof Error ? e : new Error(String(e));
            }
          }

          phaseOutputs[agent.id] = full;

          enqueue({
            type: "agent_round_complete",
            agentId: agent.id,
            round: phaseIndex,
            phase,
            text: full,
          });

          allMessages.push({
            agent_id: agent.id,
            agent_name: agent.name,
            content: full,
            round: phaseIndex,
            debate_phase: debatePhase,
          });
        }

        if (phaseIndex === 0) round1 = { ...phaseOutputs };
        else if (phaseIndex === 1) round2 = { ...phaseOutputs };
        else round3 = { ...phaseOutputs };
      }

      enqueue({ type: "synthesis_start" });

      let synthesisText = "";
      const models = getDiscussionModelsOrdered();
      if (models.length === 0) {
        throw new Error(
          "No AI providers configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY.",
        );
      }
      for (let mi = 0; mi < models.length; mi++) {
        try {
          const result = streamSynthesis({
            topic: run.topic,
            userMessage: run.user_message,
            round1,
            round2,
            round3,
            model: models[mi],
            systemPrefix: systemPrefix || undefined,
          });
          synthesisText = await collectStreamedAssistantText(result, (chunk) => {
            enqueue({ type: "synthesis_token", text: chunk });
          });
          if (!synthesisText.trim()) {
            throw new Error("Empty synthesis response");
          }
          break;
        } catch (e) {
          if (mi < models.length - 1) {
            console.warn(
              `[ai] synthesis fallback ${mi + 1}→${mi + 2}/${models.length}:`,
              e instanceof Error ? e.message : e,
            );
            continue;
          }
          throw e instanceof Error ? e : new Error(String(e));
        }
      }

      enqueue({ type: "synthesis_complete", text: synthesisText });

      allMessages.push({
        agent_id: "synthesis",
        agent_name: "Synthesis",
        content: synthesisText,
        round: 3,
        debate_phase: "synthesis",
      });

      const stopReason = "Debate complete — three rounds + synthesis";

      for (const m of allMessages) {
        await supabase.from("agent_messages").insert({
          run_id: runId,
          agent_id: m.agent_id,
          agent_name: m.agent_name,
          content: m.content,
          round: m.round,
          debate_phase: m.debate_phase,
        });
        await supabase.from("audit_events").insert({
          run_id: runId,
          event_type: "agent_responded",
          payload: {
            agent_id: m.agent_id,
            round: m.round,
            debate_phase: m.debate_phase,
            length: m.content.length,
          },
        });
      }

      const actionPlan = buildActionPlanForCue({
        synthesis: synthesisText,
        defenseRound: round3,
      });

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

      enqueue({
        type: "discussion_complete",
        gateId: gate.id,
        criticExcerpt: round3.critic ?? "",
        synthesisExcerpt: synthesisText,
        stopReason,
        summaryLabel: "Debate complete — 3 rounds + synthesis",
        finalRound: DEBATE_PHASES.length,
        maxRounds: DEBATE_PHASES.length,
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
