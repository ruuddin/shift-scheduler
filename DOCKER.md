# Local dev with Docker

Reproducible local dev: one container running the Next.js dev server with hot
reload. No Node/npm version juggling on the host — you only need Docker.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin), 4.x+.
- A Supabase project (create one at https://supabase.com). Apply the SQL in
  `supabase/` in order — `schema.sql` → `rls.sql` → `seed.sql` — in the
  Supabase SQL editor (demo team + one published week come from `seed.sql`).
- Host port 3000 free.

## Quick start

```bash
# 1. First time: create your local env file from the template
cp .env.example .env.local   # then fill in at least NEXT_PUBLIC_SUPABASE_URL
                             # and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 2. Build + start (first run builds the image; ~1 min after that it's cached)
docker compose up

# 3. Open http://localhost:3000
```

- Code edits on the host hot-reload inside the container (bind mount).
- The app runs in **demo mode** if the Supabase vars are missing (graceful
  fallback built into `lib/`), so `docker compose up` boots even with an empty
  `.env.local` — but real data needs the cloud project wired up.
- Stop: `Ctrl+C`, or `docker compose down` from another shell.
- Rebuild after changing `package.json`/lockfile: `docker compose build`.
- Run inside the container: `docker compose exec web npm run lint`.

## Env vars (all optional except the two Supabase ones)

Loaded from `.env.local` (git-ignored — never commit secrets). Full list and
explanations live in `.env.example`:

| Var | Needed for |
| --- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Required** — all auth + data |
| `TWILIO_*` | SMS shift reminders |
| `RESEND_API_KEY` | Email reminders |
| `STRIPE_*` | Billing |
| `FEATURE_FLAGS` | Kill switches, e.g. `FEATURE_FLAGS="no-guided-tour"` |
| `MAINTENANCE_WINDOW` | Nightly maintenance banner window (PT) |

## What's containerized

- `web` — the Next.js dev server (`npm run dev`, Node 20-alpine, matching CI).
  `node_modules` and `.next` live in named volumes so the bind mount never
  fights the host OS or leaves stale caches.

## What's NOT containerized, and why

- **Supabase (Postgres + auth + RLS) — stays cloud.** The app authenticates
  against Supabase Auth and relies on row-level security baked into the cloud
  project. A bare local Postgres container would be a different database with
  none of that (no auth server, no RLS policies, no GoTrue), so it would not
  give a faithful local replica — just a second place to keep in sync. The
  honest local story is: run the app in Docker, point it at a real Supabase
  project (a free-tier project or a throwaway dev project per developer).
- Twilio / Resend / Stripe — third-party SaaS, same reasoning; stubbed by the
  app when their keys are absent.

## Optional: validate the production build locally

The Dockerfile has a `build` target that mirrors CI (install → `next build`).
It never touches Vercel — production still deploys from the repo as before:

```bash
docker build --target build .
```

## Troubleshooting

- **Port already in use**: stop the local `npm run dev` first, or remap the
  host port in `docker-compose.yml` (`"3001:3000"`).
- **Blank/stale page after pulling new code**: `docker compose build --no-cache web`
  then `docker compose up` (clears the `.next` named volume too).
- **Node version mismatch**: the image pins `node:20-alpine`, the same as
  `.github/workflows/ci.yml`. Host Node is irrelevant inside the container.
