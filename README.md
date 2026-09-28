# Shift Scheduler

Subscription scheduling for small teams (restaurants, retail shops, clinics) —
$2–5/employee/month. Simple alternative to When I Work and Deputy.

V1: drag-and-drop weekly roster builder, shift swap requests with manager
approval, time-off requests + tracking, SMS/email shift reminders, Stripe billing.

## Stack

- Next.js (App Router) + TypeScript + Tailwind on Vercel
- Supabase (Postgres + auth + row-level security)
- Stripe (per-seat billing) · Twilio (SMS) · Resend (email)

## Run it

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key (Day 2)
npm run dev                   # http://localhost:3000
```

## Project layout

- `app/` — routes (manager roster, employee "my shifts", requests)
- `supabase/` — database files, applied in order in the Supabase SQL editor:
  `schema.sql` → `rls.sql` → `seed.sql` (demo team + one published week)
- `.env.example` — required env keys per integration

## Build log

Daily change history lives in the "Shift Scheduler - Build Plan" Google Drive
folder — one doc per day (Day 1 … Day 14). Every change is logged in that
day's doc; old docs are never rewritten.

## Feature flags

`lib/flags.ts` — server-side kill switches, all default ON. Set `FEATURE_FLAGS`
(comma-separated) to override: `"all"`, `"none"`, or individual flags, with
`no-<flag>` to disable one default-on flag.

| Flag | Gates |
| ---- | ----- |
| `dnd-scheduling` | Drag-and-drop moving of shifts on the roster |
| `shift-crud` | Create / edit / delete shifts (grid UI + server actions) |
| `guided-tour` | First-run guided tour for new users |
| `maintenance-banner` | Nightly maintenance banner during the test window |

## Nightly testing

`tests/smoke/run.js` — browserless smoke checks (root redirect, roster demo
data, login form, dashboard, maintenance banner inside the 11pm–1am PT
window). `tests/load/run.js` — light load probe (10 concurrent workers, 30s,
p99 budget 2000ms, zero errors). Target defaults to production; override with
`TEST_BASE_URL`.

```bash
npm run test:e2e    # smoke checks
npm run test:load    # load probe
npm run test:nightly # both, as the nightly cron runs them
```

A scheduled job runs `npm run test:nightly` daily at ~11:15pm PT and reports
pass/fail. The maintenance banner (`maintenance-banner` flag,
`MAINTENANCE_WINDOW`) shows in the app during the 11pm–1am PT window.

## Deploy

Import the GitHub repo in Vercel. Set the same env vars from `.env.example`
in the Vercel project settings.
