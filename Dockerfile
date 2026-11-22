# BRAIN BATTLE as a single Vercel container Function.
#
# Vercel detects this file, builds it, and routes every request to the
# resulting image — so the client, the REST routes and the Socket.IO upgrade
# all share one origin, exactly as they do under `npm start` locally. Nothing
# in the engine, the client or the store changes.
#
# Read the deployment caveats in AGENTS.md before relying on this: the match
# engine keeps state in memory, and Vercel does not guarantee that two players
# reach the same instance.

# ---------------------------------------------------------------- build stage
FROM node:22-alpine AS build
WORKDIR /app

# Manifests first so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
# --include=dev because the client build needs Vite, a dev dependency. Nothing
# from this stage survives into the final image except apps/web/dist.
RUN npm ci --include=dev

COPY . .
RUN npm run build

# -------------------------------------------------------------- runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Vercel routes container traffic to port 80 unless PORT is set in the project
# settings. Matching that default here keeps the dashboard free of setup steps.
ENV PORT=80

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
# Production dependencies only: Vite, Tailwind, TypeScript and puppeteer-core
# stay behind in the build stage, which keeps the image inside Vercel's limits.
RUN npm ci --omit=dev && npm cache clean --force

# @brain-battle/shared resolves to ./src/index.ts, so the server runs the
# package's TypeScript source through tsx — the source has to ship.
COPY packages/shared/src packages/shared/src
COPY apps/server/src apps/server/src
COPY --from=build /app/apps/web/dist apps/web/dist

EXPOSE 80

# node is PID 1 with tsx as a loader, rather than `npm start`. Vercel stops an
# instance with SIGTERM and a 30s grace period, and the server's shutdown hook
# only runs if that signal is not swallowed by an intermediate npm process.
CMD ["node", "--import", "tsx", "apps/server/src/index.ts"]
