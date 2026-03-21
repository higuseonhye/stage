# Context layer (Context Graph)

This is the **infer → validate → run** loop, not a long chat.

## Data shape (AI-filled)

Defined in [`lib/context-graph.ts`](../lib/context-graph.ts):

| Field | Role |
|--------|------|
| `idea` | Product / initiative |
| `target` | Customer / ICP |
| `stage` | `idea` \| `mvp` \| `growth` |
| `market` | Problem space |
| `competition` | Short list (competitors / substitutes) |
| `advantage` | Edge |
| `goal` | Near-term outcome |

Users do **not** fill a form for these fields. The model proposes them from a **single line**; the user confirms or sends natural-language **feedback** to refine (`/api/context/refine`).

## UX

1. [`/runs/new`](../app/(director)/runs/new/page.tsx) — one-line input → **Understand** (`POST /api/context/infer`).
2. Review card — **Looks good** (locks graph into topic + director brief) or **Edit** (feedback → `POST /api/context/refine`).
3. Project + topic/brief (pre-filled from the graph) → **Open the stage**.

## APIs

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/context/infer` | Body `{ line }` → `{ graph }` |
| `POST` | `/api/context/refine` | Body `{ graph, feedback }` → `{ graph }` |

Uses `generateObject` + `PERFORMANCE_MODEL` for structured output.

## Seeding `projects.context_snapshot`

1. **New project** — `POST /api/projects` accepts optional `contextGraph` (same shape as infer). The server stores `initialSnapshotFromGraph()` in `context_snapshot` (graph fields + `_meta.source: "context_layer"`).
2. **Existing project** — `POST /api/runs` accepts optional `contextGraph`. If the project’s snapshot is still empty (no `idea` string), it seeds once with the same helper before the run is created.

The dashboard shows a **Context graph** collapsible under each project when `idea` / `stage` / `goal` are present (see `dashboardSummaryFromSnapshot` in [`lib/context-graph.ts`](../lib/context-graph.ts)).

## Relation to “Context Reconstruction Engine”

- **Context layer** = first-run **situation graph** from minimal input.
- **Context reconstruction** ([`docs/context-reconstruction-engine.md`](./context-reconstruction-engine.md)) = **ongoing** merge of performance outputs into `projects.context_snapshot` across runs.

Together they aim at a **context-aware decision OS**: structured state, not endless chat-only UI.
