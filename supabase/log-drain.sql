-- Log drain storage: Vercel function logs, ingested by
-- app/api/log-drain/route.ts (see docs/LOG-DRAIN.md).
--
-- Model:
--   app_logs — one row per drained log record. Extracted columns
--              (ts, source, path, status_code, message) cover the common
--              p99-investigation queries; the full Vercel record is kept
--              in `raw` (jsonb) for everything else.
--
-- Access: RLS is enabled with NO policies — the only writer is the
-- service-role client behind the secret-gated drain endpoint, and reads
-- happen in the Supabase dashboard / SQL editor. Nothing here is ever
-- exposed to app users.

create table if not exists app_logs (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  ts timestamptz,
  source text,
  path text,
  status_code int,
  message text,
  raw jsonb not null
);

create index if not exists app_logs_received_idx
  on app_logs (received_at desc);
create index if not exists app_logs_path_idx
  on app_logs (path, received_at desc);

alter table app_logs enable row level security;
-- No policies on purpose: service-role bypasses RLS; anon/authenticated
-- roles get nothing.
