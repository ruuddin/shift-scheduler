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
