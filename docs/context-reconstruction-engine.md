# Context Reconstruction Engine (Stage)

This is **not** a standalone npm module. It is implemented **inside Stage** so it can use real `runs`, `projects`, `/api/discuss`, and `/api/approve` without mocks.

## Where the code lives

| Piece | Location |
|--------|----------------|
| Merge LLM (JSON snapshot) | [`lib/context.ts`](../lib/context.ts) — `updateContextSnapshot`, `persistProjectContextAfterPerformance` |
| Inject into discussion | [`app/api/discuss/route.ts`](../app/api/discuss/route.ts) — loads `projects.context_snapshot`, prepends `systemPrefix` |
| Stream wiring | [`lib/stream.ts`](../lib/stream.ts) — `streamAgentTurn({ systemPrefix })` prefixes agent system prompts |
| After performance | [`app/api/approve/route.ts`](../app/api/approve/route.ts), [`app/api/runs/[id]/retry-step/route.ts`](../app/api/runs/[id]/retry-step/route.ts) — build run summary → `persistProjectContextAfterPerformance` |
| Data | [`supabase/migrations/20250320140000_projects.sql`](../supabase/migrations/20250320140000_projects.sql) — `projects`, `runs.project_id` |

## Flow

1. **New run** — User picks a project on `/runs/new`; optional preview of `context_snapshot`.
2. **Discuss** — If the run has `project_id`, non-empty `context_snapshot` is injected into every agent turn (above the actor’s system prompt).
3. **Approve + performance** — When the four-step pipeline completes, pipeline outputs are summarized as text and merged into `projects.context_snapshot` via the model in `PERFORMANCE_MODEL`.
4. **Deny** — No performance → no snapshot merge (per product spec).

## Database

If project creation or listing fails with “relation … does not exist” or schema cache errors, apply:

`supabase/migrations/20250320140000_projects.sql`

in the Supabase SQL Editor (or your migration pipeline).
