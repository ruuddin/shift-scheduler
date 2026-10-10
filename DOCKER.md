# Local development with Docker

Run the whole app in a container so every developer gets the same Node version
and dependencies — no "works on my machine". This is **local dev only**:
production deploys to Vercel straight from git and never uses these files,
so nothing here can break the Vercel deploy.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)
- A Supabase project (the app's data + auth backend). Use the existing
  `shift-scheduler` project or create a scratch one for local work.

## Setup

1. Copy the env template and fill in your values:

   ```sh
   cp .env.example .env.local
   ```

   At minimum set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Supabase dashboard → Project Settings → API). Server-side reads also use
   `SUPABASE_READER_URL` / `SUPABASE_READER_ANON_KEY` when set, and writes use
   `SUPABASE_SERVICE_ROLE_KEY`. `.env.local` is gitignored — secrets never
   leave your machine.

2. Build and start:

   ```sh
   docker compose up --build
   ```

3. Open http://localhost:3000. Edits on your host hot-reload in the container
   (the working tree is mounted into `/app`).

## Running the test suites in the container

```sh
# Smoke tests against the containerized dev server:
docker compose run --rm -e TEST_BASE_URL=http://web:3000 web npm run test:e2e

# Or run any suite (test:load, test:docs, test:security, test:api, ...):
docker compose run --rm -e TEST_BASE_URL=http://web:3000 web npm run test:docs
```

Note: the repo's test scripts send `Connection: close` because the CI VM's
egress proxy breaks HTTP keep-alive. On your own machine that header is
harmless, so the scripts work the same inside or outside Docker.

## Troubleshooting

- **Port 3000 already in use** — stop the local `npm run dev` first, or change
  the port mapping in `docker-compose.yml` (e.g. `"3001:3000"`).
- **Supabase config errors in the browser** — you skipped step 1, or the values
  in `.env.local` are wrong. The container boots fine without them so you can
  still work on pages that don't need data.
- **Slow first start** — `npm ci` runs once during the build; later starts reuse
  the cached layer until `package.json` changes.
- **Node version drift** — the image pins `node:22-alpine`, matching what the
  repo's CI uses. If `package.json` ever gains an `engines` field, update the
  `FROM` line to match.
