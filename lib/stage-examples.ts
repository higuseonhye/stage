/**
 * Canonical copy for /runs/new example cards.
 * Human-readable mirror: STAGE_EXAMPLES.md (keep in sync verbatim).
 */

export type StageExample = {
  id: string;
  title: string;
  topic: string;
  brief: string;
};

export const STAGE_EXAMPLES: StageExample[] = [
  {
    id: "1",
    title: "Should we stop building and start selling first?",
    topic: "Should we stop building and start selling first?",
    brief: `Two co-founders, pre-revenue, shipped a rough MVP with a dozen design partners. Half want more features; half say they’d pay if we paused shipping and focused on a real sales motion. Runway is about nine months. Need: honest tradeoffs, a single recommendation the director can cue, and what we should validate in the next four weeks—not a generic essay.`,
  },
  {
    id: "2",
    title: "First hire: engineer or salesperson?",
    topic: "First hire: engineer or salesperson?",
    brief: `Post-MVP with a few paying pilots and roughly $2k MRR. Founder capacity is the bottleneck: one founder codes full-time, the other covers everything else. We can afford one hire this quarter. Need: side-by-side comparison, hire-order rationale, biggest risks of choosing wrong, and how each path changes the 90-day plan.`,
  },
  {
    id: "3",
    title: "What should we charge for our first paid plan?",
    topic: "What should we charge for our first paid plan?",
    brief: `B2B tool for small teams. Competitors land roughly $15–89 per user per month. We’re about to publish pricing for the first time—no formal willingness-to-pay study yet. Want: a small set of anchor options, packaging angles (seats vs usage), what to test first with prospects, and what not to give away in early deals.`,
  },
  {
    id: "4",
    title: "Monolith or microservices for our MVP?",
    topic: "Monolith or microservices for our MVP?",
    brief: `Four engineers rebuilding a messy prototype into something we can ship and operate. Hot debate: microservices so squads can move in parallel vs monolith until we feel real pain. Need: a decision framework, an MVP-appropriate default, when we’d reconsider, and a short director-ready paragraph to approve.`,
  },
];

export const DEFAULT_EXAMPLE_ID = "1";
