# Stage

AI agents on stage — you direct. Actors discuss in parallel; you hold the **cue** (approve / deny / edit) before **performance** runs; the **script** records an append-only audit trail.

## Stack

- Next.js (App Router), TypeScript, Tailwind, shadcn/ui  
- Supabase (Postgres, Auth, Realtime)  
- Vercel AI SDK with Anthropic (primary) and OpenAI (fallback)

## Setup

1. **Environment** — copy `.env.example` to `.env.local` and fill values.

2. **Supabase** — create a project, run the SQL in `supabase/migrations/20250320060000_init.sql` (SQL editor or CLI). Enable **Email** auth provider.

3. **Install & dev**

   ```bash
   npm install
   npm run dev
   ```

4. **Deploy (Vercel)** — set the same env vars. Long-running routes (`/api/discuss`, `/api/approve`) set `maxDuration` to 300s; on Hobby, limits are lower — upgrade or move execution to a background worker for heavy workloads.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/login`, `/signup` | Supabase email/password |
| `/dashboard` | Run list |
| `/runs/new` | Start a run |
| `/runs/[id]` | Discussion, cue, performance, script |
| `/settings` | Theme + env notes |

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

- `POST /api/runs` — create run  
- `POST /api/discuss` — NDJSON stream, parallel agents + optional self-refine  
- `POST /api/approve` — approve / deny / edit+approve; runs two execution steps  
- `POST /api/runs/[id]/retry-step` — retry a failed step  

## License

Private / your org.
