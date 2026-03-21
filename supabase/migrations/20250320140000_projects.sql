-- Project layer: accumulated context across runs (Context Reconstruction Engine)

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  goal text,
  context_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_user_created
  on public.projects (user_id, created_at desc);

alter table public.runs
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists idx_runs_project on public.runs (project_id);

comment on table public.projects is 'User-scoped projects; context_snapshot merges learnings from completed performance runs';
comment on column public.projects.context_snapshot is 'JSON blob merged by LLM after each performance completion';

alter table public.projects enable row level security;

create policy "projects_own"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime optional for projects (dashboard uses server fetch). Run manually if needed:
-- alter publication supabase_realtime add table public.projects;
