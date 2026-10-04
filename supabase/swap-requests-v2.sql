-- Shift swaps v2: bring the pre-org swap_requests table into the org model.
--
-- Adds: org_id, team_id (scoping), target_shift_id (mutual swaps),
-- note, decided_by/decided_at (manager decision audit).
-- Backfills org_id/team_id from the shift's team.
-- Replaces the stale user_metadata-role RLS policies with org-model ones.
-- Seeds the 'shift-swaps' feature flag (default on).

-- ============ columns ============
alter table swap_requests
  add column if not exists org_id uuid references organizations(id) on delete cascade,
  add column if not exists team_id uuid references teams(id) on delete cascade,
  add column if not exists target_shift_id uuid references shifts(id) on delete set null,
  add column if not exists note text,
  add column if not exists decided_by uuid references employees(id) on delete set null,
  add column if not exists decided_at timestamptz;

-- Backfill scoping from the shift's team -> org.
update swap_requests sr
set team_id = s.team_id,
    org_id = t.org_id
from shifts s
join teams t on t.id = s.team_id
where sr.shift_id = s.id
  and (sr.team_id is null or sr.org_id is null);

create index if not exists swap_requests_team_status_idx
  on swap_requests (team_id, status);
create index if not exists swap_requests_org_idx on swap_requests (org_id);
create index if not exists swap_requests_requested_by_idx on swap_requests (requested_by);

-- ============ feature flag ============
insert into feature_flags (flag_key, description, default_enabled) values
  ('shift-swaps', 'Employees request shift swaps; managers approve or decline.', true)
on conflict (flag_key) do nothing;

-- ============ RLS ============
alter table swap_requests enable row level security;

drop policy if exists managers_all_swap_requests on swap_requests;
drop policy if exists employees_own_swaps on swap_requests;

-- Org managers: full access to swap requests in their org.
create policy swap_mgr_all on swap_requests
  for all
  using (is_org_manager(swap_requests.org_id, auth.uid()))
  with check (is_org_manager(swap_requests.org_id, auth.uid()));

-- Employees: read requests they made or that target them.
create policy swap_emp_read on swap_requests
  for select
  using (
    requested_by in (select id from employees where user_id = auth.uid())
    or target_employee_id in (select id from employees where user_id = auth.uid())
  );

-- Employees: create requests for their own shifts in their teams.
create policy swap_emp_insert on swap_requests
  for insert
  with check (
    requested_by in (select id from employees where user_id = auth.uid())
    and team_id in (
      select team_id from employees where user_id = auth.uid()
    )
  );

-- Employees: cancel their own pending requests.
create policy swap_emp_cancel on swap_requests
  for update
  using (
    status = 'pending'
    and requested_by in (select id from employees where user_id = auth.uid())
  )
  with check (
    status = 'cancelled'
    and requested_by in (select id from employees where user_id = auth.uid())
  );
