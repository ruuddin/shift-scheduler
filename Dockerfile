# Dev-focused Dockerfile for local development ONLY.
#
# Production deploys to Vercel directly from the repo (see README.md); this
# Dockerfile is never used by the production build, so it cannot break it.
#
# Node version matches CI (.github/workflows/ci.yml -> setup-node v4, node 20).

# ---------------------------------------------------------------------------
# Stage 1: install dependencies (cached independently of source changes)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci = reproducible installs from the lockfile
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 2: dev — run the Next.js dev server with hot reload
# ---------------------------------------------------------------------------
FROM node:20-alpine AS dev
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
# Source is provided by a bind mount in docker-compose.yml (live code reload).
# Copying it here too makes the image runnable standalone via `docker run`.
COPY . .
EXPOSE 3000
# Bind 0.0.0.0 so the host can reach the server through the published port.
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

# ---------------------------------------------------------------------------
# Stage 3 (optional): build — validate the production build in CI-like env.
# Use: docker build --target build .
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build
