# Pattern — Incremental Frontend Migration (No Big-Bang Rewrite)

Created 2026-10-17. Source: Kamran Ahmed, "Incrementally Migrating our
Legacy Frontend App — roadmap.sh"
(https://www.youtube.com/watch?v=69Z9DNCXTpo).

**Queue mismatch, flagged honestly:** YouTube action item #45 listed this
URL as "Must Know Browser Dev Tool Tip" and asked for the tip to be added
to the frontend *debugging* workflow. The URL actually resolves to the
migration video above — it contains no browser devtools tip. Rather than
invent one, this doc captures the technique the video actually teaches and
adopts it as our standard frontend-migration pattern. If a different video
was meant, point us at it and the debugging-workflow doc will be written
from that instead.

## The technique (from the video)

Never rewrite a live frontend in one big-bang launch. Instead:

1. **Split the site into sets of pages** (by route prefix / feature area).
2. **Rebuild one set at a time** in the new app. roadmap.sh started with
   account + teams.
3. **Run old and new apps side by side** in production.
4. **Put a reverse proxy in front** (nginx in the video): a location rule
   sends requests whose path matches a migrated prefix to the new app;
   everything else falls through to the old app.
5. **Repeat set by set** until the old app serves nothing, then retire it.
6. In the new app, **cache request data client-side** (they use React
   Query) so navigation doesn't repeat requests or do full page reloads —
   the migrated sections ended up faster than the old ones, which builds
   confidence to continue.

Why it works: every step is reversible (flip the proxy rule back), users
only ever see working pages, and the migration can pause at any set
boundary without stranding half-finished work.

## Adoption for Shift Scheduler

This is the standard approach for any future frontend migration or
framework move in this repo — and it's already the shape of work in
flight:

- The **service split** (`docs/SERVICE-SPLIT-PLAN.md`, PR #39) is this
  pattern applied to apps instead of page sets: the owner console moves
  to `apps/admin` while the customer portal stays in `apps/web`, with the
  two running side by side before cutover.
- Where the video uses nginx location rules, our equivalent is Vercel
  routing (project domains / rewrites) plus cross-app links
  (`ADMIN_APP_URL`) — see the split plan's cutover steps.
- Rule for future migrations here: **page-set by page-set, proxy-routed,
  reversible at every step; no big-bang launches.**
