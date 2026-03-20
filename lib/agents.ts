export type AgentDefinition = {
  id: string;
  name: string;
  role: string;
  color: "blue" | "amber" | "teal" | "purple";
  systemPrompt: string;
};

export const AGENTS: AgentDefinition[] = [
  {
    id: "analyst",
    name: "Analyst",
    role: "Breaks down the problem and extracts signals.",
    color: "blue",
    systemPrompt: `You are the Analyst actor on a stage panel. You dissect the director's topic, surface facts, unknowns, and measurable signals. Be direct and structured. End with a line starting with "Insight:" capturing your sharpest takeaway.`,
  },
  {
    id: "critic",
    name: "Critic",
    role: "Challenges assumptions and surfaces risks.",
    color: "amber",
    systemPrompt: `You are the Critic actor. Challenge assumptions, name failure modes, ethical or operational risks, and what could go wrong. Be constructive but skeptical. End with a line starting with "Risk:" summarizing the top concern.`,
  },
  {
    id: "strategist",
    name: "Strategist",
    role: "Proposes action paths and recommends a plan.",
    color: "teal",
    systemPrompt: `You are the Strategist actor. Synthesize the discussion into 2–4 concrete strategic options and recommend one with rationale. End with a section titled "Proposed action plan:" followed by numbered steps a human director could approve.`,
  },
  {
    id: "executor",
    name: "Executor",
    role: "Turns strategy into executable steps.",
    color: "purple",
    systemPrompt: `You are the Executor actor. Translate strategy into an ordered checklist of execution steps (inputs, owners as roles, outputs). Stay practical. End with a section titled "Execution checklist:" with bullet points.`,
  },
];

export const AGENT_COLOR_CLASSES: Record<
  AgentDefinition["color"],
  { border: string; text: string; bg: string; ring: string }
> = {
  blue: {
    border: "border-blue-500/60",
    text: "text-blue-300",
    bg: "bg-blue-500/10",
    ring: "ring-blue-500/30",
  },
  amber: {
    border: "border-amber-500/60",
    text: "text-amber-300",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/30",
  },
  teal: {
    border: "border-teal-500/60",
    text: "text-teal-300",
    bg: "bg-teal-500/10",
    ring: "ring-teal-500/30",
  },
  purple: {
    border: "border-purple-500/60",
    text: "text-purple-300",
    bg: "bg-purple-500/10",
    ring: "ring-purple-500/30",
  },
};

export function agentById(id: string): AgentDefinition | undefined {
  return AGENTS.find((a) => a.id === id);
}
