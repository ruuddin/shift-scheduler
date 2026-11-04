# Local development image for shift-scheduler.
#
# This image is ONLY for `docker compose up` on a developer machine.
# Production deploys to Vercel straight from git and never touches this file,
# so adding Docker here cannot break the Vercel deploy.
#
# The compose file mounts the working tree over /app, so edits on the host
# hot-reload inside the container via the Next.js dev server.

FROM node:22-alpine

WORKDIR /app

# Install dependencies first so this layer is cached until package.json changes.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the source. (Compose will mount the live working tree over this,
# but the COPY keeps `docker build` / `docker run` usable without compose.)
COPY . .

EXPOSE 3000

# Next.js dev server, bound to all interfaces so the host can reach it.
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]
