-- Announcements: org-level and team-level broadcast messages.
--
-- Model:
--   announcements — title + body, always belongs to an org; team_id NULL
--                   means org-wide (every team in the org sees it), otherwise
--                   it's scoped to the selected team(s) via one row per team.
--                   Posted by org managers only (is_manager role).
--
-- This is the app's first broadcast communication channel. There is no
-- DM / team-chat; announcements are one-to-many, newest first.

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade, -- null = org-wide
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists announcements_org_idx
  on announcements (org_id, created_at desc);
create index if not exists announcements_team_idx
  on announcements (team_id, created_at desc);

-- Seed the feature flag (behind which the whole feature sits).
insert into feature_flags (flag_key, description, default_enabled) values
  ('announcements', 'Org-level and team-level announcements posted by managers.', true)
on conflict (flag_key) do nothing;

-- ============ RLS ============
-- Readers: any member of the org can read announcements in their org
-- (org-wide ones, plus ones scoped to their teams). Writers: org managers
-- only — enforced again in app code via requireOrgManagerForActiveTeam().

alter table announcements enable row level security;

drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements
  for select using (
    exists (
      select 1 from org_memberships m
      where m.org_id = announcements.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists announcements_write on announcements;
create policy announcements_write on announcements
  for all using (
    is_org_manager(announcements.org_id, auth.uid())
  )
  with check (
    is_org_manager(announcements.org_id, auth.uid())
  );
