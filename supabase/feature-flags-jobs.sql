-- Feature flags + background jobs + analytics tables.
--
-- Flags:
--   feature_flags        — catalog of flags (key, description, default state)
--   team_feature_flags   — per-team overrides (a manager toggles their own team)
--   flag_toggle_history  — every toggle, with who made it (admin-visible)
--
-- Jobs:
--   jobs                 — registry: key, description, frequency, enabled
--   job_runs             — every execution: started/finished, status, output
--
-- Analytics:
--   analytics_daily_active — per-day, per-team active-user rollup (90 days)

-- ============ feature flags ============

create table if not exists feature_flags (
  flag_key text primary key,
  description text not null,
  default_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists team_feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null references feature_flags(flag_key) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  enabled boolean not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (flag_key, team_id)
);

create table if not exists flag_toggle_history (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null references feature_flags(flag_key) on delete cascade,
  team_id uuid references teams(id) on delete cascade, -- null = global default changed
  old_enabled boolean,
  new_enabled boolean not null,
  toggled_by uuid references auth.users(id) on delete set null,
  toggled_by_email text,
  toggled_at timestamptz not null default now()
);

create index if not exists flag_toggle_history_flag_idx
  on flag_toggle_history (flag_key, toggled_at desc);

-- Seed the flag catalog: existing env-controlled flags plus the first
-- DB-backed rollout (team-branding).
insert into feature_flags (flag_key, description, default_enabled) values
  ('dnd-scheduling', 'Drag-and-drop moving of shifts on the roster grid.', true),
  ('shift-crud', 'Create / edit / delete shifts (UI and server actions).', true),
  ('guided-tour', 'First-run guided tour for new users.', true),
  ('maintenance-banner', 'Nightly maintenance banner during the test window.', true),
  ('team-branding', 'Team logo and brand color on the dashboard.', true)
on conflict (flag_key) do nothing;

-- ============ background jobs ============

create table if not exists jobs (
  job_key text primary key,
  description text not null,
  frequency text not null, -- e.g. 'daily', 'hourly', 'weekly'
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null references jobs(job_key) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- running | succeeded | failed
  output text,
  error text,
  triggered_by text not null default 'cron' -- cron | manual | <user email>
);

create index if not exists job_runs_job_idx
  on job_runs (job_key, started_at desc);

-- Seed the job registry.
insert into jobs (job_key, description, frequency, enabled) values
  ('analytics-daily-rollup',
   'Aggregates per-team, per-day active users from the event log for the last 90 days.',
   'daily', true)
on conflict (job_key) do nothing;

-- ============ analytics rollup ============

create table if not exists analytics_daily_active (
  day date not null,
  team_id uuid not null references teams(id) on delete cascade,
  active_users int not null default 0,
  managers_active int not null default 0,
  employees_active int not null default 0,
  computed_at timestamptz not null default now(),
  primary key (day, team_id)
);

-- ============ RLS ============
-- App code enforces team scoping + manager authorization (see ADR-001);
-- these policies mirror the existing pattern on teams/events.

alter table feature_flags enable row level security;
alter table team_feature_flags enable row level security;
alter table flag_toggle_history enable row level security;
alter table jobs enable row level security;
alter table job_runs enable row level security;
alter table analytics_daily_active enable row level security;

-- Authenticated users can read the flag catalog (evaluation needs it).
drop policy if exists "read flags" on feature_flags;
create policy "read flags" on feature_flags
  for select to authenticated using (true);

-- Team members can read their own team's overrides.
drop policy if exists "read own team flags" on team_feature_flags;
create policy "read own team flags" on team_feature_flags
  for select to authenticated using (
    exists (
      select 1 from employees e
      where e.team_id = team_feature_flags.team_id
        and e.user_id = auth.uid()
    )
  );

-- Toggle history is manager-visible; app layer restricts to own team / global.
drop policy if exists "read flag history" on flag_toggle_history;
create policy "read flag history" on flag_toggle_history
  for select to authenticated using (true);

-- Job registry + runs are readable by authenticated users (admin UI gates by role).
drop policy if exists "read jobs" on jobs;
create policy "read jobs" on jobs
  for select to authenticated using (true);

drop policy if exists "read job runs" on job_runs;
create policy "read job runs" on job_runs
  for select to authenticated using (true);

-- Analytics rollups are readable by members of the team they describe.
drop policy if exists "read own team analytics" on analytics_daily_active;
create policy "read own team analytics" on analytics_daily_active
  for select to authenticated using (
    exists (
      select 1 from employees e
      where e.team_id = analytics_daily_active.team_id
        and e.user_id = auth.uid()
    )
  );
