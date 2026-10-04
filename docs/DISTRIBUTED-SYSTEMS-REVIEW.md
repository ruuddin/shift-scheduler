# Distributed Systems Review — Shift Scheduler

**Date:** 2026-10-04
**Scope:** Read-only review of `~/workspace/shift-scheduler` (Next.js 16 on Vercel
serverless, Supabase Postgres + Auth in us-west-1, no ORM, cookie-based
team/org context, RLS authorization, Vercel-cron background jobs, DB-backed
feature flags with org ceilings, append-only `events` audit log).
**Method:** Code reading only — `docs/ADR-001-architecture.md`, `lib/db.ts`,
`lib/orgs.ts`, `lib/flags.ts`, `lib/jobs.ts`, `app/api/cron/jobs/route.ts`,
`middleware.ts`, `app/event-actions.ts`, `supabase/*.sql`. No code changed, no
migrations run, no database touched.

**Verdict up front:** this is a sensibly built small-SaaS serverless app, not a
distributed system in the academic sense — and that is the right call at this
scale. Vercel and Supabase absorb most classic distributed-systems pain
(multi-AZ, failover, connection pooling). The real risks found are all in the
app's *own* code and ops practices, not the platform. Findings are ordered by
honest severity: "real risk" vs "correctly deferred at this scale".

---

## 1. The Twelve-Factor App

| # | Factor | Assessment |
|---|--------|------------|
| I | Codebase | ✅ **Conform.** One repo, `main` protected, feature-branch PR flow, release branches cut per deploy. |
| II | Dependencies | ✅ **Conform.** `package.json` / `package-lock.json`, no vendored or system-level deps. |
| III | Config | ✅ **Conform (with one wart).** Supabase URL/keys, `CRON_SECRET`, `OWNER_EMAILS`, `FEATURE_FLAGS` all in env. Wart: `/api/cron/jobs` accepts `?secret=<CRON_SECRET>` — the secret lands in Vercel access logs and any proxy logs (see queued action 6). |
| IV | Backing services | ⚠️ **Mostly conform.** Supabase is treated as an attached resource via env, and `lib/db.ts` even abstracts a future read replica. Gap: **preview deployments share the production database** (`docs/ADR-001` weak spot 6) — the dev/prod line is drawn by convention, not infrastructure. |
| V | Build, release, run | ✅ **Conform.** Vercel builds from git; `/api/version` reports the deployed SHA; release branches are cut only after the deploy is proven live. |
| VI | Processes | ⚠️ **Gap — the flag cache breaks shared-nothing.** `lib/flags.ts` keeps a **process-local** 24h `evalCache` (`Map`), and `invalidateFlagCache()` (called from `app/admin/actions.ts`, `app/org-actions.ts`) only clears the instance that handled the toggle. On Vercel's multi-instance serverless fleet, a flag toggle — including a **kill-switch during an incident**, the documented mitigation in the troubleshooting runbook — can take up to **24 hours** to reach warm instances. There is no Redis/Upstash or any cross-instance invalidation. **Real risk.** |
| VII | Port binding | ✅ N/A — platform-provided. |
| VIII | Concurrency | ✅ **Conform.** Stateless serverless functions scale horizontally; no in-process coordination assumed (except the flag cache, factor VI). |
| IX | Disposability | ⚠️ **Mostly conform.** Fast startup, no local state to drain. Gap: the cron rollup has **no checkpointing**, but `runJob`'s upsert-based jobs are idempotent so a killed run can safely re-run. However a killed run stays `'running'` in `job_runs` forever — no reaper (see queued action 4). |
| X | Dev/prod parity | ❌ **Gap (accepted risk).** Preview deploys share prod Supabase (factor IV), and preview *mode* (no keys) silently serves in-memory demo data — a misconfigured deploy looks healthy while persisting nothing (`docs/ADR-001` weak spot 5). At this scale the cost of a full staging stack outweighs the benefit, but the failure mode is silent. |
| XI | Logs | ⚠️ **Partial.** The `events` table is a good append-only audit log, and Vercel captures stdout. Gap: **no log aggregation, no error tracking, no alerting** — a failing nightly job is visible only if someone opens `/admin/jobs`. Nobody is paged. |
| XII | Admin processes | ⚠️ **Gap — migrations are manual toil.** Schema changes are pasted into the Supabase dashboard SQL editor by hand. There is no versioned migration runner (`supabase db push`, sqitch, etc.). This already caused a real bug: the `announcements_write` policy shipped with **reversed `is_org_manager` arguments** and had to be fixed same-day. **Real risk.** |

---

## 2. AWS Well-Architected Framework — Reliability pillar

### Foundations
- ✅ **Conform at this scale.** Single region (`us-west-1`), managed Postgres, managed auth. No self-managed networking to get wrong. Multi-region/active-active would be gold-plating for a cafe-scheduling SaaS — correctly not done.
- ⚠️ **Backup/restore is unverified.** Supabase provides point-in-time recovery, but no restore has ever been tested and no backup policy is documented. You don't have backups until you've restored one.

### Change management
- ✅ **Strong.** Feature flags with org ceilings, per-team overrides, toggle history (`flag_toggle_history`), preview deployments per PR, required CI (lint + `eslint-plugin-security` SAST + build), release branches as rollback points, troubleshooting runbook documenting rollback.
- ⚠️ **Rollback is documented but untested.** The runbook says "roll back to the release branch" — it has never been rehearsed. An untested rollback plan is a hope.
- ❌ **Manual migrations** (factor XII) are the weakest change-management link: no dry-run, no down-migration, applied by a human in a web console.

### Failure management
- ⚠️ **No retries, timeouts, or backoff anywhere in `lib/`.** Every Supabase call is a single attempt; a transient network blip fails the request. The analytics rollup pages the `events` table 1000 rows at a time with no retry — one failed page aborts the whole nightly job.
- ⚠️ **No circuit breaker / bulkhead.** Fine at this scale (the DB is the only dependency), but worth naming.
- ❌ **Cron has no distributed lock and no stale-run reaping.** `runJob` (`lib/jobs.ts`) inserts a `'running'` row via `job_run_start`, then runs. Two overlapping invocations (Vercel cron retry, or a manual run-now colliding with cron) both proceed — the rollup is idempotent so this is benign *today*, but any future non-idempotent job would double-execute. Worse: if the function is killed mid-run, the row stays `'running'` forever and `/admin/jobs` lies about it.
- ❌ **Silent error swallowing.** `lib/orgs.ts` is full of `catch { return null }` (`getTeamOrgId`, `getActiveOrg`, `resolveActiveOrgId`). A DB outage doesn't raise — it silently resolves to *no org* or *the wrong org* (`resolveActiveOrgId` falls back to `orgs[0]`, and `getMyOrgs` has no `ORDER BY`, so the fallback org is nondeterministic). Fail-open context resolution is a **real risk**: better to fail the request loudly than serve the wrong organization's data.
- ⚠️ **No rate limiting** on server actions, `/api/cron/jobs`, or auth endpoints (Supabase Auth has built-in abuse protection; app-level actions have none).

---

## 3. The Fallacies of Distributed Computing

1. **"The network is reliable."** ❌ Assumed everywhere. `catch { return null }` in `lib/orgs.ts` treats a network/DB failure as "no data" and the app continues with degraded-but-plausible context (see Failure management). The one place this is done *right*: `lib/jobs.ts` — job failures are recorded with status and error, not swallowed.
2. **"Latency is zero."** ⚠️ Request paths chain sequential DB round trips: `getActiveOrg()` → `resolveActiveOrgId()` → `getMyOrgs()` → org fetch, plus `getTeamOrgId()`, each a separate hop to `us-west-1`. The dashboard fans out further. No batching or dataloaders. At current scale this is tens-of-ms overhead per hop — acceptable, but page latency will grow linearly with feature count. Watch, don't fix yet.
3. **"Bandwidth is infinite."** ✅ Fine. The rollup pages in 1000-row chunks; nothing ships large payloads.
4. **"The network is secure."** ❌ Two concrete holes: (a) `?secret=` on the cron route leaks `CRON_SECRET` into logs; (b) the `events` audit table has **no RLS policies at all** (absent from `supabase/rls.sql`) — anyone holding the anon key can read the full event history (actor emails included) and *write* forged audit entries. The audit log's integrity is currently trust-based. **Real risk.**
5. **"Topology doesn't change."** ✅ Effectively true: Vercel edge → single-region Supabase. No service discovery, no dynamic membership.
6. **"There is one administrator."** ✅ Handled deliberately: `OWNER_EMAILS` allowlist, fail-closed, separates SaaS-owner admin from customer managers.
7. **"Transport cost is zero."** ✅ Negligible at this scale (Supabase egress within normal SaaS bounds).
8. **"The network is homogeneous."** ⚠️ Preview mode vs live mode is a *behavioral* heterogeneity: same code, different persistence semantics, chosen silently by the presence of env vars. Already bitten once in spirit (the "looks working, persists nothing" failure mode).

---

## 4. Google SRE principles (as applicable to a small SaaS)

- **SLIs/SLOs/error budgets:** ❌ None defined. Appropriate to skip formal SLOs at this size — but the *idea* matters: nobody has written down "the dashboard must load" vs "the nightly rollup may lag a day." Recommend a one-paragraph verbal contract, not a full SRE book implementation.
- **Monitoring & alerting:** ❌ The biggest SRE gap. `/admin/jobs` shows job health and `/activity` shows events, but **nothing pushes**: no email/Slack on job failure, no error-rate visibility, no uptime check. The nightly security tests run, but their failures go nowhere automatically. A dead cron or a broken deploy is discovered by a human noticing.
- **Toil:** ❌ Manual SQL-editor migrations are textbook toil — manual, repetitive, error-prone, and already produced one bug. Automating this (versioned migrations in CI) is the highest-leverage SRE investment available.
- **Blameless culture / learning from failure:** ✅ Genuinely good. The troubleshooting runbook (`/admin/troubleshooting`), dated change-history docs, release branches, and the security review queue all institutionalize learning. The reversed-policy-argument incident was caught, fixed, and recorded same-day.
- **Automation over toil:** ⚠️ Mixed. Release branches and nightly tests are automated; migrations and owner onboarding (`OWNER_EMAILS` hand-configured in Vercel) are not.
- **Progressive rollout:** ✅ Feature flags with org ceilings are exactly the SRE-recommended safe-rollout mechanism — undermined only by the cross-instance staleness in factor VI.

---

## QUEUED ACTION LIST (highest risk first)

| # | What | Why | Size |
|---|------|-----|------|
| 1 | **Add RLS policies to the `events` table** (org-scoped read for managers, insert for members, no anon access) | Audit log currently readable *and writable* by anyone with the anon key — confidentiality and integrity of the audit trail are trust-based. Real risk. | S |
| 2 | **Fix cross-instance flag-cache staleness** — shorten `evalCache` TTL (e.g. 60s) and/or move invalidation to a shared store; at minimum document that kill-switches propagate in ≤ TTL | The incident runbook's kill-switch mitigation doesn't work reliably on a multi-instance fleet today. Real risk. | M |
| 3 | **Versioned, CI-applied migrations** (e.g. `supabase db push` from `supabase/migrations/`) instead of hand-pasted SQL | Already caused one real bug (reversed policy args); every future schema change re-rolls the dice. Kills toil too. | M |
| 4 | **Cron hardening:** distributed lock (advisory lock or `job_runs` claim row) + reap stale `'running'` rows older than N minutes | Overlapping invocations double-run future non-idempotent jobs; killed runs lie on `/admin/jobs` forever. | S |
| 5 | **Fail loudly, not open, on DB errors in context resolution** — remove `catch { return null }` in `lib/orgs.ts` hot paths, or throw a typed error the UI renders as an error page | Silent fallback to the wrong org is worse than an error page. Real risk. | S |
| 6 | **Remove `?secret=` auth on `/api/cron/jobs`** — header-only `Authorization: Bearer`, and have Vercel Cron send it | Secrets in URLs end up in access logs. | S |
| 7 | **Push alerting for job failures and nightly-test failures** (email via the existing Resend-adjacent plans, or Slack webhook) | Failures are currently discovered by humans opening dashboards. | S |
| 8 | **Deterministic org fallback** — `ORDER BY created_at` in `getMyOrgs()` | Nondeterministic fallback org on cookie mismatch; trivial fix while in the area. | S |
| 9 | **Retry with backoff on Supabase calls** (or at least in `lib/jobs.ts` paging loop) | One transient blip kills the whole nightly rollup today. | M |
| 10 | **Tested backup/restore** — document Supabase PITR policy, perform one restore drill to a scratch project | "We have backups" is unproven until a restore is rehearsed. | M |
| 11 | **Rehearse the rollback runbook once** (deploy previous release branch to a preview, verify) | An untested rollback plan is a hope, not a control. | S |
| 12 | **Separate staging database** for preview deployments | Preview deploys share prod data; a preview bug can corrupt prod. Worth doing once customer count grows; overkill today. | L |

---

## Non-goals (correctly NOT worth doing at this scale)

- **Multi-region / active-active.** Single-region `us-west-1` on managed services is the right reliability-per-dollar tradeoff for a scheduling SaaS. Revisit at 10x scale or contractual uptime requirements.
- **Read replicas.** `lib/db.ts` already abstracts the split; don't provision one until read load justifies it.
- **Dedicated Redis / shared cache.** Fixing factor VI does not require Redis — a short TTL plus DB-read-through is sufficient at this request volume.
- **Event sourcing / CQRS / message queues.** The append-only `events` table plus idempotent cron jobs cover current needs. A queue (e.g. for notifications) becomes justified when email/SMS features land — not before.
- **Service mesh, circuit breakers, chaos engineering.** No internal service-to-service calls exist; there is nothing to mesh.
- **Formal SLOs with error budgets.** A one-paragraph verbal reliability contract beats a spreadsheet nobody reads at this team size.
- **Sharding / partitioning.** The 90-day analytics pruning keeps the hot dataset small; revisit when a single table approaches Supabase plan limits.

---

## Files reviewed

`docs/ADR-001-architecture.md`, `lib/db.ts`, `lib/orgs.ts` (partial), `lib/flags.ts`
(partial), `lib/jobs.ts`, `app/api/cron/jobs/route.ts`, `middleware.ts`,
`app/event-actions.ts`, `supabase/schema.sql`, `supabase/rls.sql`,
`supabase/organizations.sql` (partial). Read-only; nothing modified, no
migrations run, no database touched.
