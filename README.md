# Stage

**AI agents on stage — you direct.** Four actors (Analyst, Critic, Strategist, Executor) discuss in parallel on the **stage**; you hold the **cue** (approve, deny, or edit) before **performance** runs; the **script** is an append-only audit log with realtime updates.

## What you get

- Email auth (Supabase), one workspace per account, run list + run detail  
- **Discussion:** NDJSON stream, optional self-refine (extra rounds), pins in local storage  
- **Cue:** approval gate with critic context and full action plan text  
- **Performance:** two execution steps after approve (Analyst → Executor), retry on failed step  
- **New run:** four clickable examples (defaults to example 1); copy lives in [`STAGE_EXAMPLES.md`](./STAGE_EXAMPLES.md) and must stay in sync with [`lib/stage-examples.ts`](./lib/stage-examples.ts)

## Stack

| Layer | Choice |
|--------|--------|
| App | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| Data / auth | Supabase Postgres, Auth, Realtime |
| AI | Vercel AI SDK — Anthropic primary, OpenAI fallback |

## Setup

1. **Env** — `cp .env.example .env.local` and set at least `NEXT_PUBLIC_SUPABASE_*`, plus `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY`. See [`.env.example`](./.env.example) for optional model overrides.

2. **Database** — In Supabase, run [`supabase/migrations/20250320060000_init.sql`](./supabase/migrations/20250320060000_init.sql). Enable the **Email** auth provider.

3. **Run locally**

   ```bash
   npm install
   npm run dev
   ```

4. **Deploy (e.g. Vercel)** — Same env vars. `POST /api/discuss` and `POST /api/approve` declare `maxDuration = 300`; Hobby plans enforce a lower cap — use Pro or offload long work to a queue if you hit timeouts.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/login`, `/signup` | Sign in / sign up |
| `/dashboard` | Runs for your workspace |
| `/runs/new` | Topic + brief (+ example cards) |
| `/runs/[id]` | Discussion, cue, execution timeline, audit log |
| `/settings` | Light/dark + env reminder |

## API (cookie session)

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/runs` | Create run |
| `POST` | `/api/discuss` | Stream discussion (NDJSON); persists messages + approval gate |
| `POST` | `/api/approve` | Approve / deny / edit+approve; runs execution steps |
| `POST` | `/api/runs/[id]/retry-step` | Retry a failed execution step (`{ "stepId" }`) |

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
app/
  (director)/     # Authenticated shell: dashboard, runs, settings
  api/            # runs, discuss, approve, retry-step
  login, signup, page.tsx
components/       # DiscussionPanel, ApprovalGate, ExecutionTimeline, AuditLog, …
lib/
  agents.ts       # Roster + prompts
  stream.ts       # AI SDK streaming helpers
  stage-examples.ts
  supabase/
    browser.ts    # Client Components only
    server.ts     # Server Components / Route Handlers only
  workspace.ts, execution.ts, run-messages.ts, …
supabase/migrations/
STAGE_EXAMPLES.md
```

Supabase clients are split so `next/headers` never ships to the browser — import `@/lib/supabase/browser` or `@/lib/supabase/server` accordingly.
