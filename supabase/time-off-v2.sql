-- Time off v2: bring the pre-org time_off_requests table into the org model,
-- and add a weekly availability template per employee.
--
-- time_off_requests adds: org_id, team_id (scoping), decided_by/decided_at.
-- Backfills org_id/team_id from the employee's team.
-- Replaces the stale user_metadata-role RLS policies with org-model ones.
-- Seeds the 'time-off' feature flag (default on).
--
-- New table employee_availability: one row per (employee, weekday);
-- available=false means "not available this day", with optional
-- unavailable time window (unavailable_from/unavailable_to, local time).

-- ============ time_off_requests columns ============
alter table time_off_requests
  add column if not exists org_id uuid references organizations(id) on delete cascade,
  add column if not exists team_id uuid references teams(id) on delete cascade,
  add column if not exists decided_by uuid references employees(id) on delete set null,
  add column if not exists decided_at timestamptz;

-- Backfill scoping from the employee's team -> org.
update time_off_requests tor
set team_id = e.team_id,
    org_id = t.org_id
from employees e
join teams t on t.id = e.team_id
where tor.employee_id = e.id
  and (tor.team_id is null or tor.org_id is null);

create index if not exists time_off_requests_team_status_idx
  on time_off_requests (team_id, status);
create index if not exists time_off_requests_org_idx on time_off_requests (org_id);
create index if not exists time_off_requests_employee_idx on time_off_requests (employee_id);

-- ============ availability table ============
create table if not exists employee_availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday
  available boolean not null default true,
  unavailable_from time, -- optional window within the day
  unavailable_to time,
  updated_at timestamptz default now(),
  unique (employee_id, weekday)
);

create index if not exists employee_availability_team_idx
  on employee_availability (team_id);
create index if not exists employee_availability_org_idx
  on employee_availability (org_id);

-- ============ feature flag ============
insert into feature_flags (flag_key, description, default_enabled) values
  ('time-off', 'Employees request time off and set weekly availability; managers approve time off.', true)
on conflict (flag_key) do nothing;

-- ============ RLS: time_off_requests ============
alter table time_off_requests enable row level security;

drop policy if exists managers_all_time_off on time_off_requests;
drop policy if exists employees_own_time_off on time_off_requests;

-- Org managers: full access to requests in their org.
create policy time_off_mgr_all on time_off_requests
  for all
  using (is_org_manager(time_off_requests.org_id, auth.uid()))
  with check (is_org_manager(time_off_requests.org_id, auth.uid()));

-- Employees: read their own requests.
create policy time_off_emp_read on time_off_requests
  for select
  using (
    employee_id in (select id from employees where user_id = auth.uid())
  );

-- Employees: create requests for themselves in their teams.
create policy time_off_emp_insert on time_off_requests
  for insert
  with check (
    employee_id in (select id from employees where user_id = auth.uid())
    and team_id in (
      select team_id from employees where user_id = auth.uid()
    )
  );

-- Employees: cancel their own pending requests.
create policy time_off_emp_cancel on time_off_requests
  for update
  using (
    status = 'pending'
    and employee_id in (select id from employees where user_id = auth.uid())
  )
  with check (
    status = 'cancelled'
    and employee_id in (select id from employees where user_id = auth.uid())
  );

-- ============ RLS: employee_availability ============
alter table employee_availability enable row level security;

-- Org managers: read the whole team's availability (write via app actions).
create policy availability_mgr_read on employee_availability
  for select
  using (is_org_manager(employee_availability.org_id, auth.uid()));

-- Employees: manage their own availability rows.
create policy availability_emp_all on employee_availability
  for all
  using (employee_id in (select id from employees where user_id = auth.uid()))
  with check (
    employee_id in (select id from employees where user_id = auth.uid())
    and team_id in (
      select team_id from employees where user_id = auth.uid()
    )
  );
