/** Shape of agent_messages rows used for UI hydration */

export type AgentMessageLike = {
  agent_id: string;
  content: string;
  round: number;
  created_at: string;
};

/** Latest round (then created_at) per agent — for discussion cards */
export function latestContentByAgent(
  messages: AgentMessageLike[],
): Record<string, string> {
  const best = new Map<
    string,
    { round: number; t: number; content: string }
  >();
  for (const m of messages) {
    const t = new Date(m.created_at).getTime();
    const cur = best.get(m.agent_id);
    if (
      !cur ||
      m.round > cur.round ||
      (m.round === cur.round && t >= cur.t)
    ) {
      best.set(m.agent_id, { round: m.round, t, content: m.content });
    }
  }
  return Object.fromEntries(
    [...best.entries()].map(([id, v]) => [id, v.content]),
  );
}

export function latestCriticContent(messages: AgentMessageLike[]): string {
  const critic = messages.filter((m) => m.agent_id === "critic");
  if (!critic.length) return "";
  critic.sort(
    (a, b) =>
      b.round - a.round ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return critic[0]?.content ?? "";
}
