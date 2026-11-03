# WebMCP: `get_roster_week`

One read-only WebMCP tool exposing the roster to browser AI agents, built
following Chrome's WebMCP series (the "safer tools" and "evaluate your
tools" guides, plus the DevTools WebMCP panel docs).

## What it is

WebMCP is a draft W3C API (`document.modelContext`, previously
`navigator.modelContext`) that lets a page register typed tools an in-tab
AI agent can call instead of scraping the DOM. It is experimental: Chrome
149–156 origin trial, or the `chrome://flags/#enable-webmcp-testing` flag
for local development. On browsers without it, this feature is inert.

The tool:

- **Name:** `get_roster_week`
- **Input:** optional `week` — a Monday date as `YYYY-MM-DD`; defaults to
  the current week. No other parameters (`additionalProperties: false`).
- **Output:** the active team's roster for that week — member names, roles,
  and shift times (day, HH:MM start/end UTC as stored, published status).
  Compact lines, capped server-side at 200 shifts and client-side at
  ~6000 characters.
- **Files:** `lib/webmcp/roster-tool.ts` (descriptor + execute),
  `app/WebMCPTools.tsx` (registration, mounted in `app/layout.tsx`),
  `app/api/webmcp/roster/route.ts` (data), `tests/webmcp/run.js`
  (checks, wired into `test:nightly`), `supabase/webmcp-roster-tool.sql`
  (flag seed).
- **Flag:** `webmcp-roster-tool` (default on; also in `FLAG_DEFAULTS`,
  so it works before the SQL row exists).

## Safety decisions (Chrome's guide, applied)

| Guide point | How this tool complies |
|---|---|
| `readOnlyHint` | Set. The tool never writes; the route is GET-only. |
| `untrustedContentHint` | Set. Roster entries are manager-entered text (UGC); the agent must treat output as data, not orders. |
| Same scope as the UI | The route requires a signed-in user AND a manager of the active team (`requireOrgManagerForActiveTeam`, the same gate as `/roster`). Employees get a 403, other teams are never reachable. |
| Minimal output | Names, roles, shift times only. No emails, no row IDs (the app never exposes enumerable IDs), no shift notes. |
| `exposedTo` | Left unset — the tool is available to the page's own agent context only. Cross-origin exposure would need an explicit trust decision. |
| Description budget | Description is under Chrome's 500-character recommendation. |
| Input validation | Week format validated client-side (no fetch on bad input) AND server-side, before auth (so a 400 leaks nothing). |
| Fail-closed | No WebMCP in the browser → registration is skipped, app unchanged. Flag off → component renders nothing. |

## Data route contract

`GET /api/webmcp/roster?week=YYYY-MM-DD`

- Bad/missing-shape week → 400 (checked before auth).
- No session → 401. Signed in but not a manager of the active team → 403.
- Success → `{ week_start, week_end, team_name, shift_count, truncated, members: [{ name, role, shifts: [{ day, start, end, published }] }] }`.
- Times are HH:MM UTC as stored in the database.

## How to test it yourself (Chrome)

1. Enable `chrome://flags/#enable-webmcp-testing` and relaunch.
2. Sign in as a manager, open any page.
3. DevTools → Application → WebMCP: `get_roster_week` should appear
   under Available Tools. Click it, enter a week (or leave it blank),
   Run tool — you should see the active team's roster.
4. Console equivalent:
   ```js
   const mc = document.modelContext ?? navigator.modelContext;
   (await mc.getTools()).map(t => t.name);
   await mc.executeTool('get_roster_week', {});
   ```
5. Negative checks: signed out → "not signed in" message; employee
   account → manager-only message; `week: "soon"` → validation message
   with no network request.

## Evaluation (2026-11-03)

- **Harness (`tests/webmcp/run.js`): 11/11 PASS** — route rejects bad
  weeks with 400 before auth, returns 401 without a session, and the
  shipped descriptor carries the safety properties above (name, description
  budget, both hints, closed schema, no emails/IDs in output shaping,
  client-side week validation).
- **Build:** lint clean on all new/changed files; `next build` passes;
  the registration code (`get_roster_week`, `modelContext`) is confirmed
  present in the built client bundle.
- **Live browser, managed browser:** the managed browser cannot reach a
  localhost dev server (its requests to `127.0.0.1` are rejected before
  loading, while public sites load fine), so the in-browser check was run
  against the PR preview deployment instead — see the PR for its result.
- **Not exercised here (honest limits):** the 200 path with a real
  signed-in manager session (no test credentials are available, and
  passwords are never requested); and a flag-on agent call (needs Chrome
  with the testing flag or an origin-trial enrollment for the production
  origin — neither is set up). The 200 path reuses `getLiveWeekSchedule`
  and `requireOrgManagerForActiveTeam`, the exact code the `/roster`
  page already runs in production.
- **Production note:** shipping this is safe without an origin trial —
  without the API the code no-ops. Enrolling the production origin in
  the WebMCP origin trial is the step that would make the tool visible
  to real browser agents; that is a separate decision, not done here.
