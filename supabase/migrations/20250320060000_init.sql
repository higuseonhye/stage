-- Stage: core schema, RLS, realtime publication

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Workspace',
  created_at timestamptz not null default now(),
  constraint workspaces_one_per_owner unique (owner_id)
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  topic text not null,
  user_message text not null default '',
  status text not null default 'discussing'
    constraint runs_status_check check (
      status in (
        'discussing',
        'awaiting_approval',
        'executing',
        'completed',
        'failed'
      )
    ),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  agent_id text not null,
  agent_name text not null,
  content text not null default '',
  round integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.approval_gates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  step_id text,
  action_plan text not null default '',
  status text not null default 'pending'
    constraint approval_gates_status_check check (
      status in ('pending', 'approved', 'denied', 'edited')
    ),
  human_note text,
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.execution_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  gate_id uuid not null references public.approval_gates (id) on delete cascade,
  step_index integer not null,
  agent_id text not null,
  input text not null default '',
  output text not null default '',
  status text not null default 'queued'
    constraint execution_steps_status_check check (
      status in ('queued', 'running', 'done', 'failed')
    ),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint execution_steps_run_step_unique unique (run_id, step_index)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_runs_workspace on public.runs (workspace_id);
create index if not exists idx_runs_created on public.runs (created_at desc);
create index if not exists idx_agent_messages_run on public.agent_messages (run_id);
create index if not exists idx_approval_gates_run on public.approval_gates (run_id);
create index if not exists idx_execution_steps_run on public.execution_steps (run_id);
create index if not exists idx_audit_events_run on public.audit_events (run_id);

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.runs enable row level security;
alter table public.agent_messages enable row level security;
alter table public.approval_gates enable row level security;
alter table public.execution_steps enable row level security;
alter table public.audit_events enable row level security;

create policy "workspaces_select_own"
  on public.workspaces for select
  using (auth.uid() = owner_id);

create policy "workspaces_insert_own"
  on public.workspaces for insert
  with check (auth.uid() = owner_id);

create policy "workspaces_update_own"
  on public.workspaces for update
  using (auth.uid() = owner_id);

create policy "runs_all_in_workspace"
  on public.runs for all
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = runs.workspace_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = runs.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "agent_messages_via_run"
  on public.agent_messages for all
  using (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = agent_messages.run_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = agent_messages.run_id and w.owner_id = auth.uid()
    )
  );

create policy "approval_gates_via_run"
  on public.approval_gates for all
  using (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = approval_gates.run_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = approval_gates.run_id and w.owner_id = auth.uid()
    )
  );

create policy "execution_steps_via_run"
  on public.execution_steps for all
  using (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = execution_steps.run_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = execution_steps.run_id and w.owner_id = auth.uid()
    )
  );

create policy "audit_events_via_run"
  on public.audit_events for all
  using (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = audit_events.run_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = audit_events.run_id and w.owner_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.runs;
alter publication supabase_realtime add table public.agent_messages;
alter publication supabase_realtime add table public.approval_gates;
alter publication supabase_realtime add table public.execution_steps;
alter publication supabase_realtime add table public.audit_events;
