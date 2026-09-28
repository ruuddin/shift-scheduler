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
- `supabase/schema.sql` — database tables (applied Day 3)
- `.env.example` — required env keys per integration

## Build log

Daily change history lives in the "Shift Scheduler - Build Plan" Google Drive
folder — one doc per day (Day 1 … Day 14). Every change is logged in that
day's doc; old docs are never rewritten.

## Deploy

Import the GitHub repo in Vercel. Set the same env vars from `.env.example`
in the Vercel project settings.
