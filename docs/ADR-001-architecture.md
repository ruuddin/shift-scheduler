# ADR-001: Shift Scheduler Architecture

**Status:** Accepted (documents the system as built through 2026-10-02)
**Date:** 2026-10-02

## Context

Shift Scheduler is a team shift-scheduling web app for small businesses (cafes,
retail, restaurants). Managers build weekly rosters; employees view their
shifts. It grew feature-by-feature from a demo prototype to a production app
with real auth, and this record captures the architecture as it stands so
future changes can be validated against something explicit.

## Stack

- **Framework:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Hosting:** Vercel (GitHub integration, auto-deploy from `main`)
- **Backend:** Supabase (Postgres + Auth). App uses `@supabase/ssr` for
  cookie-based sessions in Server Components, Server Actions, and middleware.
- **No ORM.** Direct Supabase client queries. No separate API layer except
  `/api/version` (deploy SHA for the release-branch workflow).

## Data model

```
teams (id, name)
employees (id, team_id → teams, user_id → auth.users, name, email, role)
shifts (id, team_id, employee_id, starts_at, ends_at, published)
swap_requests, time_off_requests
events (append-only audit log: team_id, actor_id, actor_email, actor_role,
        event_type, entity_type, entity_id, metadata)
```

- **Team membership = `employees` rows.** One row per (user, team); a user
  with rows in two teams belongs to both. There is no separate membership
  table (deliberate — `employees` already carries `user_id` + `team_id`).
- **Active team** is a client concept: an `active_team_id` cookie (1-year),
  resolved server-side by `getActiveTeam()`. All team-scoped reads/writes
  go through it.

## Auth & authorization

- Supabase Auth (email/password). Email confirmation OFF for the pilot.
- **Roles are per-team**, stored on the `employees` row (`manager`|`employee`).
  Signup stamps `role: 'manager'` + `team_name` into auth `user_metadata`
  for convenience, but the **employee row is the source of truth** — pages
  check `getMyTeams()` for the role on the active team.
- **RLS policies** (in `supabase/rls.sql`):
  - Managers: full access to all tables *when their JWT metadata says
    `role = 'manager'`*.
  - Employees: read own employee row, own shifts; CRUD own swap/time-off
    requests; can claim an invite row by matching email.
- Session refresh via `proxy.ts` (Next 16 renamed file convention;
  `supabase.auth.getUser()` on every non-public request; skips entirely when
  Supabase keys are absent = preview mode, and skips public funnel pages
  `/login`, `/signup`, `/guide/*`).

## Key flows

- **Signup (new team):** `auth.signUp()` → try to link an invited employee
  row by email → if none, `createTeamForNewUser()` inserts `teams` +
  manager `employees` row, stamps `team_id` in metadata, sets active-team
  cookie.
- **Signup (invited):** the email-match links `user_id` onto the existing
  employee row (RLS `employees_claim_invite` policy); no new team is created.
- **Invite:** manager inserts an `employees` row with their active `team_id`;
  the invitee links it at signup.
- **Event logging:** `logEventAction()` writes to `events` (Supabase when
  live, in-memory in preview). `team_id` resolves from the employee row.
- **Release branches:** on push to `main`, `.github/workflows/release-branch.yml`
  polls public `/api/version` until it serves the pushed SHA (proving the
  deploy landed), then cuts `release/YYYY-MM-DD-<short-sha>`.

## Deployment pipeline

Feature branch → PR → required CI (`lint` incl. `eslint-plugin-security` SAST
+ `next build`) → merge to `main` (protected) → Vercel auto-deploys to
production → release-branch workflow cuts a release branch. Preview
deployments per PR.

## Test strategy

`npm run test:nightly` = smoke (6) + load + docs (23, every guide page must
return 200) + security (8: headers, HSTS, auth gates, `npm audit`,
secret scan) + api (6: version contract, auth redirects, form rendering).
Write-path user flows (signup → team → switch) are verified manually in the
browser per PR; not yet automated.

## Feature flags & background jobs (added 2026-10-03)

- **Flags:** `feature_flags` catalog (key, description, global default) +
  `team_feature_flags` per-team overrides + `flag_toggle_history` (who/when).
  Evaluation: team override → global default → `FEATURE_FLAGS` env fallback.
- **Flag cache:** process-local, 24h TTL, keyed by flag+team. Managers
  inactive for 30+ days (no events) bypass the cache and read fresh.
  Toggles invalidate immediately.
- **Reader/writer split:** `lib/db.ts` — reads via `getReader()`, writes via
  `getWriter()`. Today both hit the same Supabase project; `SUPABASE_READER_URL`
  / `SUPABASE_SERVICE_ROLE_KEY` env vars plug in a replica / service role
  without touching call sites.
- **Jobs:** `lib/jobs.ts` registry (key, description, frequency) + `job_runs`
  history. Triggered via `/api/cron/jobs` (CRON_SECRET or Vercel cron header).
  `analytics-daily-rollup` aggregates per-team daily active users for the
  last 90 days into `analytics_daily_active` (idempotent upserts).
- **Admin UI:** `/admin/flags` (defaults, rollout counts, per-team overrides,
  toggle history) and `/admin/jobs` (status, frequencies, run history, run-now).

## Organizations & role hierarchy (added 2026-10-03)

- **Tables:** `organizations`, `org_roles` (name, rank, is_manager — each org
  defines its own), `org_memberships` (user_id, role_id REQUIRED, single
  nullable manager_membership_id), `org_feature_flags`, `teams.org_id`.
- **Permissions redefined:** every `role === 'manager'` check now goes through
  `requireOrgManagerForActiveTeam()` — the user must hold a manager-granting
  role in the active team's org. "Manager" is a relationship (X manages Y)
  plus role rank, not a flat label.
- **Hierarchy invariants enforced by DB triggers** (`validate_reporting_line`):
  manager in same org, manager rank STRICTLY higher (same rank can't manage
  same rank; lower can't manage higher), no cycles, direct reports keep lower
  rank (bad demotions rejected). "One manager" is per-org (single column).
- **Backfill:** one org per existing team; team managers → Owner, other
  managers → Manager, employees → Employee; everyone reports to the Owner.
  New teams bootstrap an org via `bootstrap_org()` (security definer);
  invite-linking adds Employee membership via `add_org_member()`.
- **Flag precedence:** org is a CEILING — org-disabled beats team overrides;
  evaluation: org off → false, else team override → org on → global default →
  env. Team toggles that violate the ceiling are rejected. Org toggles clear
  the flag cache for every team.
- **Cron-safe writes:** `job_run_start/finish`, `analytics_rollup_upsert/prune`
  are security-definer functions — the cron route has no user session.
- **FIX:** PR #22 shipped select-only RLS on flags tables; this migration adds
  the missing write policies (org managers).

## Known weak spots (validate future changes against these)

1. **RLS is role-global, not team-scoped.** The manager policies check
   `user_metadata.role = 'manager'` — a manager of Team A can read/write
   Team B's rows at the database level. Application code scopes by active
   team, but the DB does not enforce it. Fix: rewrite policies to check
   membership in the row's `team_id` (e.g. `team_id IN (SELECT team_id FROM
   employees WHERE user_id = auth.uid() AND role = 'manager')`).
2. **Role in JWT metadata can drift** from the employee row (e.g. demoted
   manager keeps `role: 'manager'` in metadata until re-login). Pages use
   the employee row; RLS uses the JWT. Fix with (1).
3. **No automated write-path tests.** Signup/team-switch flows are manual.
4. **`events` table has no RLS policies** (relies on app-level manager
   checks). Anyone with the anon key could read/write it directly.
5. **Preview mode** (`!NEXT_PUBLIC_SUPABASE_URL`) silently degrades to
   in-memory demo data — useful, but a misconfigured deploy looks "working"
   while persisting nothing.
6. **Single Supabase project** — no separate staging database; preview
   deployments share production data.
