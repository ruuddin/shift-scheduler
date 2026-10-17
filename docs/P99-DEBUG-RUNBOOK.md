# Runbook — Debugging a p99 Latency Spike

Created 2026-10-17. Source: Kamran Ahmed, "Scaling Issues in 2 Minutes"
(https://www.youtube.com/watch?v=yhIhoUWuU7M) — the action-item queue listed
this video as "Debugging Slow APIs in 100 Seconds"; the URL actually resolves
to the scaling video above. Its routine — the ordered ways an API falls over
or slows down, and the fix for each — is captured here as the checklist to
work through on the next p99 investigation. Each step is mapped to this app's
stack (Vercel serverless + Supabase Postgres); gaps where we lack the
instrumentation the routine assumes are flagged **GAP** and are *not* fixed
by this doc — production changes need a separate go-ahead.

## Step 0 — Confirm the spike is real, and segment it (before the routine)

- [ ] Compare the signal sources: nightly load probe (`npm run test:load`)
      vs Vercel Speed Insights / function logs. The probe opens a fresh TLS
      connection per request through the egress proxy, so its p99 runs hot
      vs a real browser — a probe-only spike with flat Vercel numbers is a
      measurement artifact, not an incident. (Precedent: 2026-10-14, probe
      p99 3712ms for one night with the app unchanged, back under 2000ms
      the next night and ~1500ms the night after.)
- [ ] Segment by actor/route from the probe output (visitor / manager /
      employee / auth-gate over-budget counts) and by path in Vercel logs.
      Global slowness and one-slow-route are different investigations.
- [ ] Check for a deploy correlation: `GET /api/version` SHA vs the git log.

## The routine (from the video, in order)

### 1. Data safety: backups exist, off the primary, restorable
A wiped server with no external backups loses the database for good.
- [ ] Supabase dashboard → Database → Backups: confirm scheduled backups
      are running and note the retention window for our plan tier.
- **GAP:** no restore drill has ever been run or documented. A backup that
  has never been restored is a hope, not a backup.

### 2. Logs survive the process
Logs written only to stdout vanish when the process dies.
- [ ] Vercel → project → Logs: confirm function logs for the slow window
      are still visible (dashboard retention is limited — check early).
- **GAP:** no log drain is configured, so logs are gone once Vercel's
  retention passes. Persistent, searchable logs (a drain to an external
  sink) are the missing instrumentation this step assumes. The ingest
  endpoint now exists (`app/api/log-drain`, table `app_logs`); it stays
  a GAP until the one-time setup in `docs/LOG-DRAIN.md` is done (SQL
  migration + `LOG_DRAIN_SECRET` + drain created in the Vercel
  dashboard).

### 3. Crashes self-heal (auto-restart)
A memory leak shouldn't need a human to restart the app.
- [ ] Vercel → Logs filtered to errors/restarts during the window; look
      for repeated cold starts or memory-limit kills on one route.
- Serverless gives us per-invocation isolation, so a leak shows up as
  rising duration on long-lived routes rather than a crash loop — check
  function duration by route before assuming the app tier is healthy.

### 4. Database is not running on defaults
Default DB configuration falls over under production load.
- [ ] Supabase → Database → Settings/Pooling: confirm Supavisor pooling is
      in the path for serverless (our connections are short-lived and
      numerous — direct connections exhaust first).
- [ ] Check `pg_stat_statements` (Supabase → Database → Query Performance)
      for the top queries by total time during the window; a missing index
      on a growing table is the classic p99-only symptom (p50 stays fine
      until the table outgrows the cache).

### 5. Cache before you scale
Slow responses → CDN for static assets, Redis-style caching for dynamic
content.
- [ ] Static assets: confirm they're served from the Vercel edge (response
      headers `x-vercel-cache: HIT` on repeat fetches).
- [ ] Dynamic reads: per-request dedup via React `cache()` is in place for
      team/org readers (PR #38). Anything beyond that —
- **GAP:** no shared cache layer (Redis/Upstash or similar) exists. Hot
  per-team reads hit Postgres on every request. Adding one is a production
  change; propose it separately if step 4 shows DB time dominating.

### 6. App and database competing for resources
Co-located app + DB starve each other.
- Our equivalent is **region distance**, not co-location: functions are
  pinned to `sfo1`, Supabase is in `us-west-1` (PR #38). If p99 regresses,
  verify from a slow response's `x-vercel-id` that functions still run in
  `sfo1` — a region drift re-adds a cross-country round trip to *every*
  query, and a page doing 5 sequential queries pays it 5 times.

### 7. Database bottleneck as data grows → read replicas
Writes to the primary, reads from replicas.
- The codebase is already shaped for this: reads go through `getReader()`,
  writes through `getWriter()` — a replica only changes what the reader
  points at.
- **GAP:** no read replica exists today (Supabase read replicas are a paid
  add-on). Only worth it if step 4 shows read load, not query shape, is
  the bottleneck.

### 8. One server isn't enough → scale out behind a balancer
- Vercel scales functions horizontally by default; the check here is
  throttling, not capacity: look for function concurrency limits or
  Supabase pool exhaustion (step 4) masquerading as app slowness.

### 9. Centralize logs and cache once you're multi-instance
- Same two gaps as steps 2 and 5 — they are the standing instrumentation
  debt this runbook keeps pointing at: **(a) a log drain, (b) a shared
  cache**. Until they exist, investigations rely on the nightly probe
  history (`tests/monitoring/`, PR #42) and Vercel's short-retention logs.

## After the investigation

- [ ] Record the finding (route, cause, fix) in the dated change doc, per
      the change-history rule.
- [ ] If the cause was probe-only, say so plainly — don't "fix" a healthy
      app.
