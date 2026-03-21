-- Team: workspace members + invites; RLS uses user_has_workspace_access()

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role = 'member'),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user on public.workspace_members (user_id);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text,
  token text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_workspace_invites_workspace on public.workspace_invites (workspace_id);

comment on table public.workspace_members is 'Collaborators (not the owner; owner stays on workspaces.owner_id)';
comment on table public.workspace_invites is 'Pending invite links; accepted via accept_workspace_invite()';

-- -----------------------------------------------------------------------------
-- Functions (SECURITY DEFINER for invite acceptance)
-- -----------------------------------------------------------------------------

create or replace function public.user_has_workspace_access(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = wid and w.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.workspace_members m
    where m.workspace_id = wid and m.user_id = auth.uid()
  );
$$;

grant execute on function public.user_has_workspace_access(uuid) to authenticated;

create or replace function public.accept_workspace_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  wid uuid;
begin
  select i.workspace_id into wid
  from public.workspace_invites i
  where i.token = p_token
    and i.expires_at > now()
  limit 1;
  if wid is null then
    raise exception 'invalid_or_expired_invite';
  end if;
  if exists (select 1 from public.workspaces w where w.id = wid and w.owner_id = auth.uid()) then
    raise exception 'owner_no_join';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (wid, auth.uid(), 'member')
  on conflict (workspace_id, user_id) do nothing;
  delete from public.workspace_invites where token = p_token;
  return wid;
end;
$$;

grant execute on function public.accept_workspace_invite(text) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS: workspace_members & workspace_invites
-- -----------------------------------------------------------------------------

alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

create policy "workspace_members_select"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_invites_owner_all"
  on public.workspace_invites for all
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Replace workspace + run policies to include members
-- -----------------------------------------------------------------------------

drop policy if exists "workspaces_select_own" on public.workspaces;

create policy "workspaces_select_access"
  on public.workspaces for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists "runs_all_in_workspace" on public.runs;

create policy "runs_all_in_workspace"
  on public.runs for all
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = runs.workspace_id
      and public.user_has_workspace_access(w.id)
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = runs.workspace_id
      and public.user_has_workspace_access(w.id)
    )
  );

drop policy if exists "agent_messages_via_run" on public.agent_messages;

create policy "agent_messages_via_run"
  on public.agent_messages for all
  using (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = agent_messages.run_id
      and public.user_has_workspace_access(w.id)
    )
  )
  with check (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = agent_messages.run_id
      and public.user_has_workspace_access(w.id)
    )
  );

drop policy if exists "approval_gates_via_run" on public.approval_gates;

create policy "approval_gates_via_run"
  on public.approval_gates for all
  using (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = approval_gates.run_id
      and public.user_has_workspace_access(w.id)
    )
  )
  with check (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = approval_gates.run_id
      and public.user_has_workspace_access(w.id)
    )
  );

drop policy if exists "execution_steps_via_run" on public.execution_steps;

create policy "execution_steps_via_run"
  on public.execution_steps for all
  using (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = execution_steps.run_id
      and public.user_has_workspace_access(w.id)
    )
  )
  with check (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = execution_steps.run_id
      and public.user_has_workspace_access(w.id)
    )
  );

drop policy if exists "audit_events_via_run" on public.audit_events;

create policy "audit_events_via_run"
  on public.audit_events for all
  using (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = audit_events.run_id
      and public.user_has_workspace_access(w.id)
    )
  )
  with check (
    exists (
      select 1 from public.runs r
      join public.workspaces w on w.id = r.workspace_id
      where r.id = audit_events.run_id
      and public.user_has_workspace_access(w.id)
    )
  );
