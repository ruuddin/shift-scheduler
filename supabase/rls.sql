-- Shift Scheduler — Row Level Security (apply AFTER schema.sql)
-- Roles come from auth user metadata: 'manager' | 'employee' (set at signup/invite).

-- 1. Enable RLS on every table
alter table teams enable row level security;
alter table employees enable row level security;
alter table shifts enable row level security;
alter table swap_requests enable row level security;
alter table time_off_requests enable row level security;

-- 2. Managers: full access to everything
create policy managers_all_teams on teams
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager');
create policy managers_all_employees on employees
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager');
create policy managers_all_shifts on shifts
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager');
create policy managers_all_swap_requests on swap_requests
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager');
create policy managers_all_time_off on time_off_requests
  for all using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'manager');

-- 3. Employees: read their own employee row and their own shifts
create policy employees_read_self on employees
  for select using (user_id = auth.uid());
create policy employees_read_own_shifts on shifts
  for select using (
    employee_id in (select id from employees where user_id = auth.uid())
  );

-- 4. Employees: create and manage their own swap / time-off requests
create policy employees_own_swaps on swap_requests
  for all
  using (requested_by in (select id from employees where user_id = auth.uid()))
  with check (requested_by in (select id from employees where user_id = auth.uid()));
create policy employees_own_time_off on time_off_requests
  for all
  using (employee_id in (select id from employees where user_id = auth.uid()))
  with check (employee_id in (select id from employees where user_id = auth.uid()));

-- 5. Invite claim: a newly signed-up user can attach their auth id to the
--    employee row holding their email (lets signup link the invite).
create policy employees_claim_invite on employees
  for update
  using (email = (auth.jwt() ->> 'email'))
  with check (email = (auth.jwt() ->> 'email'));
