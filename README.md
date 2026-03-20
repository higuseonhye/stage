# Stage

**AI agents on stage — you direct.** Four actors (Analyst, Critic, Strategist, Executor) discuss in parallel on the **stage**; you hold the **cue** (approve, deny, or edit) before **performance** runs; the **script** is an append-only audit log with realtime updates.

## What you get

- Email auth (Supabase), one workspace per account, run list + run detail  
- **Discussion:** NDJSON stream, **adaptive rounds** (up to 5). After each round, `DISCUSSION_MODEL` (default Haiku) returns JSON with panel-wide improvement (0–100), per-actor deltas, and critic/strategist “new content” flags. **Stop** when (a) improvement &lt; 10 for **two** consecutive rounds, (b) critic has no new objections **and** strategist adds no new options, or (c) 5 rounds. UI: round label, **+Δ badges** per actor, **stop banner**, and after completion a **recharts** bar chart of refinement by round. Agent cards use **fixed max height + internal scroll**; at-a-glance summaries are heuristic (first ~chars), not a second LLM call.  
- **Cue:** approval gate with critic context + **outline / skim** lines + scrollable full plan  
- **Performance:** **four sequential steps** after approve — (1) **Analyst** — validate / stress-test plan → (2) **Critic** — risks using analyst + plan → (3) **Strategist** — refined plan from analyst + critic + plan → (4) **Executor** — operator checklist from strategist output. Each step’s output is the next step’s context. Uses **`PERFORMANCE_MODEL`** (default Sonnet).  
- **New run:** **3 runs per question** (same normalized topic + brief) **and** a **daily** cap (default **20 runs / UTC day** across all questions; set `MAX_RUNS_PER_DAY` in `.env`). `GET /api/runs/quota?topic=&userMessage=` returns both. **429** if either limit is hit.  
- Example copy: [`STAGE_EXAMPLES.md`](./STAGE_EXAMPLES.md) ↔ [`lib/stage-examples.ts`](./lib/stage-examples.ts)  
- **Decision memo:** [`docs/decision-memo.md`](./docs/decision-memo.md) is still the **blank** printable template (`/resources/decision-memo`). When a run **ends** — **deny** at the cue, or **approve** and performance completes (including after **retry** clears the last failed step) — `persistDecisionMemoForRun` generates Markdown (`PERFORMANCE_MODEL`) and **writes** `runs.decision_memo_markdown` (deny memos state non-approval and skip fabricated execution). Shown on the run page under **Decision memo — generated**. Failures emit `decision_memo_failed` in the audit log.  
- **First hire add-on:** [`docs/first-hire-decision-memo.md`](./docs/first-hire-decision-memo.md) ↔ `/resources/first-hire-memo` when that example applies  

## Stack

| Layer | Choice |
|--------|--------|
| App | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| Data / auth | Supabase Postgres, Auth, Realtime |
| AI | Vercel AI SDK — `DISCUSSION_MODEL` (panel + convergence), `PERFORMANCE_MODEL` (execution); OpenAI optional fallback |
| Charts | recharts (refinement quality after discussion) |

## Setup

1. **Env** — `cp .env.example` → `.env.local`. Set `NEXT_PUBLIC_SUPABASE_*`, `ANTHROPIC_API_KEY`, and optionally `DISCUSSION_MODEL` / `PERFORMANCE_MODEL`.

2. **Database** — Run [`supabase/migrations/20250320060000_init.sql`](./supabase/migrations/20250320060000_init.sql) (includes `runs.decision_memo_markdown` and an idempotent `add column if not exists` for older DBs). Enable **Email** auth.

3. **Dev**

   ```bash
   npm install
   npm run dev
   ```

4. **Deploy** — Same env. `POST /api/discuss` and `POST /api/approve` use `maxDuration = 300`; Hobby caps are lower — upgrade or use a queue for heavy jobs.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/login`, `/signup` | Auth |
| `/dashboard` | Runs |
| `/runs/new` | New run + **daily** quota + examples |
| `/runs/[id]` | Stage, cue, performance, script |
| `/resources/decision-memo` | Generic one-page decision memo |
| `/resources/first-hire-memo` | First-hire add-on memo |
| `/settings` | Theme + env reminder |

## API (cookie session)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/api/runs/quota?topic=&userMessage=` | `{ daily: { limit, used, remaining, resetsAt }, question: { limit: 3, used, remaining, applies } }` |
| `POST` | `/api/runs` | Create run; **429** if daily cap reached or **3 runs already** for this question |
| `POST` | `/api/discuss` | NDJSON stream: `round_start`, `token`, `agent_round_complete`, `convergence` (includes `perAgentScores`), `discussion_complete` (adds `refinementByAgent`, `improvementSeries`, `stopReason`, `finalRound`, …) |
| `POST` | `/api/approve` | Approve / deny / edit+approve; runs **4-step** performance pipeline (sequential, chained inputs) |
| `POST` | `/api/runs/[id]/retry-step` | Retry failed step — `{ "stepId" }` |
| `POST` | `/api/runs/reset` | Body `{ "confirm": "DELETE_ALL_RUNS" }` — delete every run in the workspace (cascade). Settings UI. |

## Product language

| Concept | Metaphor |
|---------|----------|
| Agents | Actors |
| Discussion panel | Stage |
| User | Director |
| Approval gate | Cue |
| Execution | Performance |
| Audit log | Script |

## Repo layout (important bits)

```text
app/api/runs/quota/route.ts   # GET — daily + per-question quota
lib/daily-run-quota.ts        # MAX_RUNS_PER_DAY (env, default 20), UTC midnight
lib/question-run-limit.ts     # MAX_RUNS_PER_QUESTION (3), normalized topic+brief
lib/stream.ts                 # DISCUSSION_MODEL / PERFORMANCE_MODEL
lib/convergence.ts            # adaptive judge (generateText → JSON)
lib/execution.ts              # performance steps (PERFORMANCE_MODEL)
components/RefinementChart.tsx
components/DiscussionPanel.tsx
```

Supabase: `@/lib/supabase/browser` (client) vs `@/lib/supabase/server` (server only).
