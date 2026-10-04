# Service Split Plan — admin portal vs customer app

**Status:** In progress (queued item #13 in `docs/DISTRIBUTED-SYSTEMS-REVIEW.md`).
**Goal:** Two separately-deployable services from one monorepo:
- `apps/web` — customer app (dashboard, roster, swaps, time-off, guides, settings, auth)
- `apps/admin` — owner console (`/admin/*`, `/guide/admin`)
- `packages/shared` — code both need (db, auth, orgs, flags, events, jobs helpers)

**Non-goals:** Splitting the database (one Supabase project stays the source of
truth; the admin app keeps service-role access for cross-client reads).
Splitting auth providers (both use the same Supabase Auth project; cookies are
per-domain so each app signs in separately).

## Checklist

- [x] **1. Break lib→app import cycles.** A shared package cannot import from
  an app. Fixed 2026-10-04 (PR #33, release `release/2026-10-04-02786ba`):
  extracted `lib/teams.ts` with team-context readers (`getMyTeams`,
  `getActiveTeam`) and context cookie constants; `lib/orgs.ts` and
  `lib/schedule-server.ts` now import from `lib/teams`;
  `app/team-actions.ts` re-exports the readers. No `lib/` module imports
  from `@/app` anymore.
- [ ] **2. Draw the split line.** Admin app owns: `app/admin/**`,
  `app/guide/admin`, `lib/owner.ts`, and the `@/app/*` modules the admin
  portal imports (`app/jobs-actions`, `app/flags-actions`,
  `app/admin/actions`, `app/event-actions`, `app/guide/components`) — each
  either moves into the admin app or down into the shared package. Decide who
  owns `/api/cron/jobs` (recommendation: `apps/web`, since jobs operate on
  customer data; admin only reads `job_runs`).
- [ ] **3. Repo layout.** npm workspaces: `apps/*`, `packages/*`. Move code,
  replace `@/` imports with package imports, set `transpilePackages` in both
  Next configs. Keep `supabase/`, `tests/`, `docs/` at the root (migrations and
  the security/docs suites stay unified until the versioned-migration work in
  queue item #3 lands).
- [ ] **4. Vercel projects.** Two projects, Root Directory `apps/web` and
  `apps/admin`. Env vars per project: `OWNER_EMAILS` on admin only; Supabase
  keys on both; `CRON_SECRET` on whichever app owns the cron route. Keep the
  existing production deployment until cutover.
- [ ] **5. Cross-app links.** The dashboard "Admin" link must point at the
  admin domain (env var, e.g. `ADMIN_APP_URL`); the admin portal's
  back-to-app links likewise. No shared cookies — each app signs in
  separately.
- [ ] **6. CI per app.** `lint` + `build` for `apps/web` and `apps/admin`
  (keep `eslint-plugin-security` required on both). Release branches per app.
  Preview deployments per app per PR.
- [ ] **7. Flag cache.** Each app keeps its own `evalCache`; document that a
  kill switch now propagates per app (ties into queued item #2 — fix the TTL
  first so both apps get a working kill switch).
- [ ] **8. Cutover.** Deploy both, verify: owner gate on admin, customer auth
  on web, flags, cron, guides. Update `docs/` and the runbook. Retire the
  unified deployment only after both are green in production.

## Ordering notes

- Do queued item **#2 (flag-cache TTL)** before step 7 — otherwise the split
  ships two broken kill switches instead of one.
- Do queued item **#3 (versioned migrations)** before step 3 if it lands first —
  a `supabase/migrations/` runner makes the monorepo move safer. Either order
  works; don't do both at once.

## References

- Martin Fowler, "Microservices" — what a service split is and isn't:
  https://martinfowler.com/microservices/
- Martin Fowler, "MonolithFirst" — the case for starting as a monolith (read
  before splitting): https://martinfowler.com/bliki/MonolithFirst.html
- Sam Newman, *Monolith to Microservices* (O'Reilly) — the migration playbook:
  strangler-fig pattern, split sequencing, data ownership.
- The Twelve-Factor App — factors I (one codebase per app), III (config in
  environment), VI (stateless processes): https://12factor.net/
- Vercel monorepo docs + Turborepo — the practical how-to for this stack:
  https://vercel.com/docs/monorepos and https://turbo.build/
- AWS Well-Architected, Reliability pillar — fault isolation, the reason to
  split at all: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html
