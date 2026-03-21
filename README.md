# Stage

**AI agents on stage — you direct.** Four actors (Analyst, Critic, Strategist, Executor) discuss in adaptive rounds; you hold the **cue** (approve, deny, or edit) before **performance** runs; the **script** is an append-only audit log with realtime updates. The **decision memo** is the final artifact — generated from discussion, cue, and execution, exportable as Markdown.

## Wedge (why this exists)

Autonomy is cheap; **governance** is not. Stage optimizes for **human approval before execution**, **traceability** (audit + memo lineage), and **honest limits** (quotas, optional rate limits, model fallback). Positioning for US/global buyers who ask for receipts — not another chat wrapper.

Public story: [`/about`](./app/about/page.tsx). Landing: [`/`](./app/page.tsx).

## What you get

- Email auth (Supabase), one workspace per account, **projects** (optional) with **`context_snapshot`** merged after each completed performance — see [`docs/context-reconstruction-engine.md`](./docs/context-reconstruction-engine.md).
- **Context layer:** one line → AI-filled graph → confirm/refine — [`/api/context/infer`](./app/api/context/infer/route.ts), [`/api/context/refine`](./app/api/context/refine/route.ts).
- **Discussion:** NDJSON stream, adaptive rounds (up to 5), convergence scoring, refinement chart.
- **Cue:** approval gate with critic context and full plan.
- **Performance:** four sequential steps after approve; retry on failure.
- **Quotas:** 3 runs per normalized question + daily cap (`MAX_RUNS_PER_DAY`, UTC). `GET /api/runs/quota`.
- **Decision memo:** persisted on `runs.decision_memo_markdown`; copy / download Markdown, print, or PDF on the run page; optional **generation timestamp** from audit `decision_memo_generated`.
- **Team invites (MVP):** workspace owner creates links in **Settings** (`GET`/`POST` [`/api/workspace/invites`](./app/api/workspace/invites/route.ts)); invitees open [`/invite/[token]`](./app/invite/%5Btoken%5D/page.tsx) and accept after sign-in. Set `NEXT_PUBLIC_APP_URL` so copied invite URLs match production.
- **Memo template:** [`/resources/decision-memo`](./app/(director)/resources/decision-memo/page.tsx) — blank printable only; not auto-filled from runs.

## AI providers (cascade)

Order: **Anthropic** (`ANTHROPIC_API_KEY`) → **OpenAI** → **Groq** → **Google Gemini**. Missing keys are skipped. Used for discussion streaming, convergence, performance steps, context infer/refine, and decision memo generation (`generateTextWithModelFallback` / `generateObjectWithModelFallback` where applicable).

See [`lib/model-fallback.ts`](./lib/model-fallback.ts) and [`lib/stream.ts`](./lib/stream.ts).

## Observability & limits (production)

| Mechanism | Purpose |
|-----------|---------|
| **Sentry** | Set `SENTRY_DSN` and/or `NEXT_PUBLIC_SENTRY_DSN`. Server + edge + client via `instrumentation*.ts`. |
| **Upstash Redis** | Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to enable sliding-window limits on `POST /api/discuss` and `POST /api/context/*`. Without Redis, limits are skipped (fine for local dev). |
| **Error UI** | `app/error.tsx`, `app/global-error.tsx` — user-facing recovery + Sentry capture. |

## Tests

```bash
npm test
```

Vitest + [`lib/question-run-limit.test.ts`](./lib/question-run-limit.test.ts). Add more pure-logic tests under `lib/**/*.test.ts`.

## Stack

| Layer | Choice |
|--------|--------|
| App | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| Data / auth | Supabase Postgres, Auth, Realtime |
| AI | Vercel AI SDK — multi-provider cascade (see above) |
| Charts | recharts |

## Setup

1. **Env** — `cp .env.example` → `.env.local`. Set `NEXT_PUBLIC_SUPABASE_*`, at least one AI provider key.

2. **Database** — Run [`supabase/migrations/20250320060000_init.sql`](./supabase/migrations/20250320060000_init.sql), then additive migrations: [`20250320120000_run_decision_memo.sql`](./supabase/migrations/20250320120000_run_decision_memo.sql), [`20250320140000_projects.sql`](./supabase/migrations/20250320140000_projects.sql), [`20250321180000_workspace_team.sql`](./supabase/migrations/20250321180000_workspace_team.sql) (team invites + shared workspace access). Enable **Email** auth.

3. **Dev**

   ```bash
   npm install
   npm run dev
   ```

4. **Deploy** — Same env. `POST /api/discuss` and `POST /api/approve` use `maxDuration = 300`; verify your host’s serverless timeout. Optional: Sentry + Upstash for production hardening.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/about` | Product story & wedge (public) |
| `/login`, `/signup` | Auth |
| `/dashboard` | Runs (onboarding banner on first visit) |
| `/runs/new` | New run + quota + examples |
| `/runs/[id]` | Stage, cue, performance, memo, script |
| `/resources/decision-memo` | Blank memo template |
| `/settings` | Theme, team invites (owner), env reminder |
| `/invite/[token]` | Accept workspace invite (public) |

## API (cookie session)

| Method | Path | Notes |
|--------|------|------|
| `GET` | `/api/runs/quota?topic=&userMessage=` | Daily + per-question quota |
| `POST` | `/api/runs` | Create run — **429** if capped |
| `POST` | `/api/discuss` | NDJSON stream — **429** if rate limited (when Upstash set) |
| `POST` | `/api/context/infer`, `/api/context/refine` | **429** if rate limited |
| `POST` | `/api/approve` | Approve / deny / edit+approve; performance pipeline |
| `GET` | `/api/workspace/invites` | List pending invites (owner) |
| `POST` | `/api/workspace/invites` | Create invite link (owner) |
| `POST` | `/api/workspace/invites/accept` | Accept invite (`{ token }`) |

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
lib/model-fallback.ts       # Provider cascade
lib/rate-limit.ts           # Optional Upstash limits
lib/context.ts              # Project snapshot merge
lib/stream.ts               # Discussion / performance streaming
instrumentation.ts          # Sentry (Node + edge)
instrumentation-client.ts   # Sentry browser
app/error.tsx               # Route error boundary
```

Supabase: `@/lib/supabase/browser` (client) vs `@/lib/supabase/server` (server only).
