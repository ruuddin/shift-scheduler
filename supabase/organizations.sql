-- Organizations, org-defined roles, reporting lines, org-level feature flags.
--
-- Model (see risk review 2026-10-03):
--   organizations        — top-level unit; teams belong to exactly one org
--   org_roles            — each org defines its own roles: name, rank, is_manager
--   org_memberships      — user belongs to org with a role (required) and at
--                          most ONE manager (manager_membership_id, nullable).
--                          Hierarchy invariants are enforced by DB triggers,
--                          not just app code:
--                            * manager must be in the same org
--                            * manager's role rank must be STRICTLY higher
--                              (same rank can't manage same rank; lower can't
--                              manage higher)
--                            * no cycles in the reporting chain
--                            * a member's direct reports must keep lower rank
--                              (demotions that would invert a line are rejected)
--   org_feature_flags    — org-level flag state; the ORG IS A CEILING:
--                          org-disabled beats any team override.
--   teams.org_id         — every team belongs to one org.
--
-- Backfill: one org per existing team (named after the team). Team managers
-- become Owners, other managers become Managers, employees become Employees.
-- Everyone except the org owner reports to the owner.

-- ============ tables ============

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists org_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  rank int not null, -- higher = more senior; manager must strictly outrank
  is_manager boolean not null default false, -- grants manager permissions
  created_at timestamptz not null default now(),
  unique (org_id, name),
  unique (org_id, rank)
);

create table if not exists org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references org_roles(id) on delete restrict,
  manager_membership_id uuid references org_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists org_memberships_user_idx
  on org_memberships (user_id);

create table if not exists org_feature_flags (
  org_id uuid not null references organizations(id) on delete cascade,
  flag_key text not null references feature_flags(flag_key) on delete cascade,
  enabled boolean not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (org_id, flag_key)
);

alter table teams add column if not exists org_id uuid
  references organizations(id);

alter table flag_toggle_history
  add column if not exists org_id uuid references organizations(id) on delete cascade;

-- ============ hierarchy enforcement (DB triggers) ============

-- Returns null when the reporting line is valid, else an error message.
create or replace function validate_reporting_line(
  p_id uuid, p_org_id uuid, p_role_id uuid, p_manager_id uuid
)
returns text as $$
declare
  mem_rank int;
  role_org uuid;
  mgr_org uuid;
  mgr_rank int;
  cur uuid;
  depth int := 0;
  rep_count int;
begin
  select rank, org_id into mem_rank, role_org
  from org_roles where id = p_role_id;
  if not found then
    return 'role does not exist';
  end if;
  if role_org != p_org_id then
    return 'role does not belong to this organization';
  end if;

  if p_manager_id is not null then
    if p_manager_id = p_id then
      return 'a member cannot be their own manager';
    end if;
    select m.org_id, r.rank into mgr_org, mgr_rank
    from org_memberships m
    join org_roles r on r.id = m.role_id
    where m.id = p_manager_id;
    if not found then
      return 'manager membership not found';
    end if;
    if mgr_org != p_org_id then
      return 'manager must belong to the same organization';
    end if;
    if mgr_rank <= mem_rank then
      return format(
        'manager rank (%s) must be strictly higher than member rank (%s) — same rank cannot manage same rank, lower cannot manage higher',
        mgr_rank, mem_rank
      );
    end if;
    -- cycle detection: walk up from the proposed manager
    cur := p_manager_id;
    while cur is not null loop
      depth := depth + 1;
      if depth > 50 then
        return 'reporting chain too deep or cyclic';
      end if;
      if cur = p_id then
        return 'reporting line would create a cycle';
      end if;
      select manager_membership_id into cur
      from org_memberships where id = cur;
    end loop;
  end if;

  -- direct reports must keep strictly lower rank (rejects bad demotions)
  select count(*) into rep_count
  from org_memberships rep
  join org_roles r on r.id = rep.role_id
  where rep.manager_membership_id = p_id
    and rep.id != p_id
    and r.rank >= mem_rank;
  if rep_count > 0 then
    return format(
      '%s direct report(s) have equal or higher rank — reassign them first',
      rep_count
    );
  end if;

  return null;
end;
$$ language plpgsql;

create or replace function trg_check_reporting_line()
returns trigger as $$
declare
  msg text;
begin
  msg := validate_reporting_line(
    NEW.id, NEW.org_id, NEW.role_id, NEW.manager_membership_id
  );
  if msg is not null then
    raise exception '%', msg;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists reporting_line_check on org_memberships;
create trigger reporting_line_check
  before insert or update of role_id, manager_membership_id
  on org_memberships
  for each row execute function trg_check_reporting_line();

-- Changing a role's rank must not invalidate existing reporting lines.
create or replace function trg_check_role_rank()
returns trigger as $$
declare
  bad uuid;
begin
  if NEW.rank = OLD.rank then
    return NEW;
  end if;
  select m.id into bad
  from org_memberships m
  where m.role_id = NEW.id
    and validate_reporting_line(m.id, m.org_id, m.role_id, m.manager_membership_id) is not null
  limit 1;
  if found then
    raise exception 'rank change would invalidate an existing reporting line';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists role_rank_check on org_roles;
create trigger role_rank_check
  before update of rank on org_roles
  for each row execute function trg_check_role_rank();

-- ============ backfill: one org per existing team ============

do $$
declare
  t record;
  new_org uuid;
begin
  for t in select id, name from teams where org_id is null loop
    insert into organizations (name) values (t.name)
    returning id into new_org;
    update teams set org_id = new_org where id = t.id;

    insert into org_roles (org_id, name, rank, is_manager) values
      (new_org, 'Owner', 100, true),
      (new_org, 'Manager', 50, true),
      (new_org, 'Employee', 10, false);
  end loop;
end $$;

-- Backfill memberships: earliest manager per team becomes Owner (no manager);
-- other managers become Managers, employees become Employees, all reporting
-- to the Owner.
do $$
declare
  o record;
  owner_uid uuid;
  owner_mem uuid;
  r record;
  target_role uuid;
  zero uuid := '00000000-0000-0000-0000-000000000000';
begin
  for o in select id from organizations loop
    select e.user_id into owner_uid
    from employees e
    join teams t on t.id = e.team_id
    where t.org_id = o.id
      and e.role = 'manager'
      and e.user_id is not null
    order by e.created_at nulls last
    limit 1;

    if owner_uid is not null then
      insert into org_memberships (org_id, user_id, role_id, manager_membership_id)
      values (
        o.id,
        owner_uid,
        (select id from org_roles where org_id = o.id and name = 'Owner'),
        null
      )
      on conflict (org_id, user_id) do nothing
      returning id into owner_mem;

      if owner_mem is null then
        select id into owner_mem
        from org_memberships
        where org_id = o.id and user_id = owner_uid;
      end if;
    end if;

    for r in
      select
        e.user_id as uid,
        max(case when e.role = 'manager' then 2 else 1 end) as lvl
      from employees e
      join teams t on t.id = e.team_id
      where t.org_id = o.id
        and e.user_id is not null
        and e.user_id != coalesce(owner_uid, zero)
      group by e.user_id
    loop
      if r.lvl = 2 then
        select id into target_role
        from org_roles where org_id = o.id and name = 'Manager';
      else
        select id into target_role
        from org_roles where org_id = o.id and name = 'Employee';
      end if;

      insert into org_memberships (org_id, user_id, role_id, manager_membership_id)
      values (o.id, r.uid, target_role, owner_mem)
      on conflict (org_id, user_id) do nothing;
    end loop;
  end loop;
end $$;

-- ============ RLS ============

alter table organizations enable row level security;
alter table org_roles enable row level security;
alter table org_memberships enable row level security;
alter table org_feature_flags enable row level security;

drop policy if exists "read own orgs" on organizations;
create policy "read own orgs" on organizations
  for select to authenticated using (
    exists (
      select 1 from org_memberships m
      where m.org_id = organizations.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "read org roles" on org_roles;
create policy "read org roles" on org_roles
  for select to authenticated using (
    exists (
      select 1 from org_memberships m
      where m.org_id = org_roles.org_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "read org members" on org_memberships;
create policy "read org members" on org_memberships
  for select to authenticated using (
    exists (
      select 1 from org_memberships m
      where m.org_id = org_memberships.org_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "read org flags" on org_feature_flags;
create policy "read org flags" on org_feature_flags
  for select to authenticated using (
    exists (
      select 1 from org_memberships m
      where m.org_id = org_feature_flags.org_id and m.user_id = auth.uid()
    )
  );

-- ============ RLS helpers (security definer: avoids policy recursion) ============

create or replace function is_org_manager(p_org_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1
    from org_memberships m
    join org_roles r on r.id = m.role_id
    where m.org_id = p_org_id
      and m.user_id = p_user_id
      and r.is_manager
  );
$$ language sql stable security definer;

create or replace function is_any_org_manager(p_user_id uuid)
returns boolean as $$
  select exists (
    select 1
    from org_memberships m
    join org_roles r on r.id = m.role_id
    where m.user_id = p_user_id
      and r.is_manager
  );
$$ language sql stable security definer;

create or replace function team_is_managed_by(p_team_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1
    from teams t
    join org_memberships m on m.org_id = t.org_id
    join org_roles r on r.id = m.role_id
    where t.id = p_team_id
      and m.user_id = p_user_id
      and r.is_manager
  );
$$ language sql stable security definer;

-- ============ write policies ============

-- Org managers can manage their org's data.
drop policy if exists "org managers write org" on organizations;
create policy "org managers write org" on organizations
  for all to authenticated
  using (is_org_manager(id, auth.uid()))
  with check (is_org_manager(id, auth.uid()));

drop policy if exists "org managers write roles" on org_roles;
create policy "org managers write roles" on org_roles
  for all to authenticated
  using (is_org_manager(org_id, auth.uid()))
  with check (is_org_manager(org_id, auth.uid()));

drop policy if exists "org managers write members" on org_memberships;
create policy "org managers write members" on org_memberships
  for all to authenticated
  using (is_org_manager(org_id, auth.uid()))
  with check (is_org_manager(org_id, auth.uid()));

drop policy if exists "org managers write org flags" on org_feature_flags;
create policy "org managers write org flags" on org_feature_flags
  for all to authenticated
  using (is_org_manager(org_id, auth.uid()))
  with check (is_org_manager(org_id, auth.uid()));

-- FIX (2026-10-03): PR #22 shipped select-only policies on the flags tables,
-- so toggles failed RLS in production. Managers of the team's org can write.
drop policy if exists "managers write team flags" on team_feature_flags;
create policy "managers write team flags" on team_feature_flags
  for all to authenticated
  using (team_is_managed_by(team_id, auth.uid()))
  with check (team_is_managed_by(team_id, auth.uid()));

drop policy if exists "managers write flag history" on flag_toggle_history;
create policy "managers write flag history" on flag_toggle_history
  for insert to authenticated
  with check (
    (team_id is null and org_id is null and is_any_org_manager(auth.uid()))
    or (team_id is not null and team_is_managed_by(team_id, auth.uid()))
    or (org_id is not null and is_org_manager(org_id, auth.uid()))
  );

-- Job registry toggling: any org manager (app layer restricts to managers).
drop policy if exists "managers write jobs" on jobs;
create policy "managers write jobs" on jobs
  for update to authenticated
  using (is_any_org_manager(auth.uid()))
  with check (is_any_org_manager(auth.uid()));

-- ============ secure bootstrap (team/org creation) ============

-- Creates an org for a team: org + seed roles + owner membership, linked to
-- the team. Idempotent. The caller must belong to the team.
create or replace function bootstrap_org(
  p_team_id uuid, p_org_name text, p_owner uuid
)
returns uuid as $$
declare
  new_org uuid;
  owner_role uuid;
begin
  if not exists (
    select 1 from employees
    where team_id = p_team_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of this team';
  end if;

  select org_id into new_org from teams where id = p_team_id;
  if new_org is not null then
    return new_org;
  end if;

  insert into organizations (name) values (p_org_name)
  returning id into new_org;

  insert into org_roles (org_id, name, rank, is_manager) values
    (new_org, 'Owner', 100, true),
    (new_org, 'Manager', 50, true),
    (new_org, 'Employee', 10, false);

  select id into owner_role
  from org_roles where org_id = new_org and name = 'Owner';

  insert into org_memberships (org_id, user_id, role_id, manager_membership_id)
  values (new_org, p_owner, owner_role, null)
  on conflict (org_id, user_id) do nothing;

  update teams set org_id = new_org where id = p_team_id;
  return new_org;
end;
$$ language plpgsql security definer;

-- Adds a user to an org as Employee reporting to the Owner.
-- Used when an invited employee's signup links their auth user.
create or replace function add_org_member(p_org_id uuid, p_user_id uuid)
returns uuid as $$
declare
  emp_role uuid;
  owner_mem uuid;
  new_id uuid;
begin
  if not (is_org_manager(p_org_id, auth.uid()) or auth.uid() = p_user_id) then
    raise exception 'not authorized';
  end if;

  select id into emp_role
  from org_roles where org_id = p_org_id and name = 'Employee';
  if emp_role is null then
    raise exception 'org has no Employee role';
  end if;

  select m.id into owner_mem
  from org_memberships m
  join org_roles r on r.id = m.role_id
  where m.org_id = p_org_id and r.name = 'Owner'
  order by m.created_at
  limit 1;

  insert into org_memberships (org_id, user_id, role_id, manager_membership_id)
  values (p_org_id, p_user_id, emp_role, owner_mem)
  on conflict (org_id, user_id) do nothing
  returning id into new_id;

  if new_id is null then
    select id into new_id
    from org_memberships where org_id = p_org_id and user_id = p_user_id;
  end if;
  return new_id;
end;
$$ language plpgsql security definer;

-- ============ cron-safe job recording (no user session on cron) ============

create or replace function job_run_start(p_job_key text, p_triggered_by text)
returns uuid as $$
declare
  new_id uuid;
begin
  insert into job_runs (job_key, status, triggered_by)
  values (p_job_key, 'running', p_triggered_by)
  returning id into new_id;
  return new_id;
end;
$$ language plpgsql security definer;

create or replace function job_run_finish(
  p_run_id uuid, p_status text, p_output text, p_error text
)
returns void as $$
begin
  update job_runs
  set status = p_status,
      finished_at = now(),
      output = p_output,
      error = p_error
  where id = p_run_id;
end;
$$ language plpgsql security definer;

create or replace function analytics_rollup_upsert(p_rows jsonb)
returns void as $$
begin
  insert into analytics_daily_active
    (day, team_id, active_users, managers_active, employees_active)
  select
    (r->>'day')::date,
    (r->>'team_id')::uuid,
    (r->>'active_users')::int,
    (r->>'managers_active')::int,
    (r->>'employees_active')::int
  from jsonb_array_elements(p_rows) as r
  on conflict (day, team_id) do update set
    active_users = excluded.active_users,
    managers_active = excluded.managers_active,
    employees_active = excluded.employees_active,
    computed_at = now();
end;
$$ language plpgsql security definer;

create or replace function analytics_rollup_prune(p_before_day date)
returns void as $$
begin
  delete from analytics_daily_active where day < p_before_day;
end;
$$ language plpgsql security definer;
