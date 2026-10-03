-- Shift Scheduler — core schema (drafted Day 1, applied + RLS policies on Day 3)
-- Run in the Supabase SQL editor.

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid, -- supabase auth user id (linked on Day 2)
  name text not null,
  email text not null,
  role text not null default 'employee', -- manager | employee
  phone text, -- for SMS reminders (Day 10)
  created_at timestamptz default now()
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  published boolean default false,
  created_at timestamptz default now()
);

create table swap_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id) on delete cascade,
  requested_by uuid references employees(id) on delete cascade,
  target_employee_id uuid references employees(id) on delete set null,
  status text not null default 'pending', -- pending | approved | declined
  created_at timestamptz default now()
);

create table time_off_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  status text not null default 'pending', -- pending | approved | declined
  created_at timestamptz default now()
);

-- Day 3: enable row-level security + per-role policies on all tables.

-- Admin event log (Day 11): append-only history of every user action.
-- Written server-side via logEventAction; read by the manager-only /admin page.
create table events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  actor_id uuid, -- supabase auth user id (null for pre-auth events like signup)
  actor_email text,
  actor_role text, -- manager | employee | null
  event_type text not null, -- e.g. 'shift.created', 'auth.login'
  entity_type text, -- 'shift' | 'employee' | 'auth' | 'team'
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index events_team_created_idx on events (team_id, created_at desc);
create index events_type_idx on events (event_type);
