# Stage

AI agents on stage — you direct. Actors discuss in parallel; you hold the **cue** (approve / deny / edit) before **performance** runs; the **script** records an append-only audit trail.

## Stack

- Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui  
- Supabase (Postgres, Auth, Realtime)  
- Vercel AI SDK — Anthropic (primary), OpenAI (fallback)

## Repository layout (high level)

| Area | Notes |
|------|--------|
| `app/(director)/` | Authenticated UI: dashboard, runs, settings |
| `app/api/` | Runs, NDJSON discussion stream, approval + execution, step retry |
| `components/` | Discussion panel, cue gate, execution timeline, audit log |
| `lib/supabase/browser.ts` | Supabase client for **Client Components** (cookies + PKCE) |
| `lib/supabase/server.ts` | Supabase client for **Server Components / Route Handlers** |
| `lib/stage-examples.ts` | Example runs for `/runs/new` (mirrors `STAGE_EXAMPLES.md`) |
| `lib/run-messages.ts` | Helpers to hydrate discussion text from `agent_messages` |
| `supabase/migrations/` | Schema, RLS, Realtime publication |

## Setup

1. **Environment** — copy `.env.example` to `.env.local` and set:

   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   - `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY`  
   - Optional: `SUPABASE_SERVICE_ROLE_KEY` (not required for the current app paths)

2. **Supabase** — create a project, run `supabase/migrations/20250320060000_init.sql` in the SQL editor (or via CLI). Under **Authentication → Providers**, enable **Email**. For local dev, you can disable “Confirm email” so sign-up immediately gets a session.

3. **Install & dev**

   ```bash
   npm install
   npm run dev
   ```

4. **Deploy (Vercel)** — add the same env vars. Routes `/api/discuss` and `/api/approve` use `maxDuration = 300`; Vercel Hobby has lower limits — upgrade or offload long work to a queue if needed.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/login`, `/signup` | Email + password (Supabase Auth) |
| `/dashboard` | Run list |
| `/runs/new` | New run + **example cards** (see `STAGE_EXAMPLES.md`) |
| `/runs/[id]` | Stage (discussion) → cue → performance → script |
| `/settings` | Light/dark + env reminders |

## Example runs

Four curated **topic + director brief** pairs live in:

- **`STAGE_EXAMPLES.md`** — readable spec  
- **`lib/stage-examples.ts`** — same content for the UI (keep in sync)

On `/runs/new`, clicking a card fills the form; **Example 1** is the default selection.

## Product language

| Concept | Metaphor |
|---------|----------|
| Agents | Actors |
| Panel | Stage |
| User | Director |
| Approval | Cue |
| Execution | Performance |
| Audit log | Script |

## API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/runs` | Create run (auto-creates workspace on first use) |
| `POST` | `/api/discuss` | NDJSON stream: 4 agents in parallel, optional self-refine (0–2 rounds) |
| `POST` | `/api/approve` | Approve / deny / edit+approve; then **sequential** execution (4 steps) |
| `POST` | `/api/runs/[id]/retry-step` | Retry one failed execution step |

### Execution pipeline (after approval)

Steps run in order; each step’s model output is passed into the next step’s prompt:

1. **Analyst** — validate & stress-test the approved plan  
2. **Critic** — risks grounded in the analyst output  
3. **Strategist** — refined plan using analyst + critic  
4. **Executor** — operator handoff checklist from the strategist output  

## Auth & troubleshooting

- **Login bounces back to `/login`** — Often a **cookie timing** issue with client navigation. This app uses a **full page navigation** (`window.location.assign`) after sign-in so the session cookie is present before the dashboard loads. Ensure `NEXT_PUBLIC_*` Supabase vars are set and match your project.  
- **Sign up “works” but you’re not logged in** — Supabase may require **email confirmation**. Check the inbox, or disable “Confirm email” under Auth settings for development.  
- **Middleware** — Refreshes the session on matched routes; protected paths are `/dashboard`, `/runs/*`, and `/settings`.

## License

Private / your org.
