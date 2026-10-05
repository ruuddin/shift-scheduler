-- Feedback: user-portal feedback form + owner review queue.
--
-- Users submit feedback (bug report, feature request, or general note) from
-- /feedback. Org managers see their org's feedback; the SaaS owner reviews
-- everything across clients at /admin/feedback.
-- Seeds the 'feedback' feature flag (default on, subject to org ceiling).

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  user_id uuid not null,
  email text,
  category text not null default 'general'
    check (category in ('bug', 'feature', 'general')),
  message text not null check (char_length(message) between 1 and 5000),
  rating int check (rating between 1 and 5),
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'resolved')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists feedback_org_status_idx
  on feedback (org_id, status, created_at desc);
create index if not exists feedback_user_idx on feedback (user_id);
create index if not exists feedback_created_idx on feedback (created_at desc);

-- ============ feature flag ============
insert into feature_flags (flag_key, description, default_enabled) values
  ('feedback', 'Users submit feedback from the portal; the owner reviews it in /admin/feedback.', true)
on conflict (flag_key) do nothing;

-- ============ RLS ============
alter table feedback enable row level security;

drop policy if exists feedback_mgr_all on feedback;
drop policy if exists feedback_emp_read on feedback;
drop policy if exists feedback_emp_insert on feedback;

-- Org managers: full access to feedback in their org.
create policy feedback_mgr_all on feedback
  for all
  using (is_org_manager(feedback.org_id, auth.uid()))
  with check (is_org_manager(feedback.org_id, auth.uid()));

-- Employees: read their own submissions.
create policy feedback_emp_read on feedback
  for select
  using (user_id = auth.uid());

-- Employees: submit feedback for an org they belong to (via their teams).
create policy feedback_emp_insert on feedback
  for insert
  with check (
    user_id = auth.uid()
    and org_id in (
      select t.org_id from teams t
      join employees e on e.team_id = t.id
      where e.user_id = auth.uid()
    )
  );
