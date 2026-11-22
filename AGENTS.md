# BRAIN BATTLE — project notes

Real-time multiplayer brain-training game. npm workspaces monorepo.

## Layout

| Path               | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `packages/shared`  | Types, socket event contracts, seeded RNG, scoring, mini-game definitions |
| `apps/server`      | Express + Socket.IO, authoritative match engine, Postgres/file store      |
| `apps/web`         | React + Vite + Tailwind v4 + Framer Motion client                         |

## Working preferences

**Auto-push is enabled.** The user does not want to ask for commits. After every
self-contained change, commit and push to `origin main` without being prompted.

Guard rails that make this safe:

1. Run `npm run typecheck` (and `npm run build` when web code changed) **before**
   pushing — the repo is public, so never auto-push code that does not compile.
2. One logical change per commit; explain *why* in the body, not *what*.
3. Re-check `git diff --cached --name-only` for `node_modules/`, `dist/`, `.env`,
   `apps/server/.data/` (contains `session.secret` and player data) before every
   commit. These are gitignored, but verify rather than trust.
4. Never auto-push force updates, history rewrites, or branch deletions.

Remote: `https://github.com/eunxiel/brain-battle` (public, default branch `main`).

## Commands

```bash
npm install            # root, installs all workspaces
npm run dev            # server (:4000) + web (:5173) together
npm run dev:server
npm run dev:web
npm run build          # production web build
npm run typecheck      # all workspaces
npm run smoke --workspace @brain-battle/server   # headless 2-client integration test
```

The smoke test needs the dev server running on :4000. It plays a full Versus
match, a full Co-op match and a Daily Challenge run over real sockets, and
asserts that no mini-game payload ever leaks its own solution to the client.

## Database

Postgres is used when `DATABASE_URL` is set (schema auto-applies from
`apps/server/src/db/schema.sql`). Without it — or if the connection fails — the
server falls back to a JSON file store in `apps/server/.data/` so the game stays
fully playable. Both implement the same `Store` interface in `apps/server/src/db/types.ts`.

Copy `.env.example` to `.env` to configure `PORT`, `CLIENT_ORIGIN`, `DATABASE_URL`
and `SESSION_SECRET`.

## Deployment

**Ship it as one service.** `npm run build && npm start` makes the server serve
`apps/web/dist` alongside the socket, so client and engine share an origin and
there is nothing to configure — no `VITE_SERVER_URL`, no `CLIENT_ORIGIN`.
`render.yaml` deploys exactly that.

The engine needs a long-lived Node process: it holds match state in memory and
keeps WebSockets open. A *static* host (GitHub Pages, or Vercel's default SPA
build) can serve the client but never runs the engine — that mismatch is what
left the old Vercel-only deploy stuck on the boot screen, with `/socket.io/`
returning 404 because nothing was listening behind it.

### Vercel (single project, container runtime)

`Dockerfile` + `vercel.json` (`"framework": "container"`) deploy the same
one-service setup as a Vercel container Function: Vercel builds the image and
routes all traffic to it, so client, REST and the Socket.IO upgrade share an
origin and no client-side URL needs configuring. The image runs
`node --import tsx apps/server/src/index.ts` so node is PID 1 and receives the
`SIGTERM` Vercel sends on scale-down. `ENV PORT=80` matches the port Vercel
routes to by default.

Required environment variables — both are *optional* on a persistent host and
*mandatory* here:

- `SESSION_SECRET` — without it `loadSessionSecret()` mints a random secret per
  process and writes it to `.data`, which is ephemeral and per-instance on
  Vercel. Every new instance would then reject every existing player token and
  silently log players out of their profiles.
- `DATABASE_URL` — `createStore()` degrades to the file store *silently* when
  Postgres is missing or unreachable, and that store is ephemeral and
  per-instance here. Profiles, leaderboards and XP would quietly diverge.

Known limits of this target, none of which apply to a persistent host:

- Vercel does not guarantee two WebSocket connections reach the same instance,
  and rooms/matches/matchmaking live in heap `Map`s. A room split across two
  instances fails with `ROOM_NOT_FOUND`. Unlikely at low traffic — one instance
  serves many connections — but the window is real during cold starts and
  deploys. Fixing it properly needs Redis room-ownership forwarding.
- A connection is cut at the function max duration: 300s on Hobby (default and
  maximum), 800s on Pro. A full match is `3200 + 12 × (4800 + roundMs)` ms,
  roughly 3–5 minutes, so long matches can exceed the Hobby ceiling.
- Instances scale to zero after 5 minutes idle, so the first visitor after a
  quiet spell pays a cold start.

Split hosting is still supported but is the harder path: `VITE_SERVER_URL`
(baked in at build time) and `CLIENT_ORIGIN` must then agree exactly, trailing
slash included, and `NODE_ENV=production` is what activates the allowlist.

## Architecture rules

- **The server is authoritative.** Clients never compute scores and never receive
  a solution before a round closes. `MiniGameDefinition.viewFor()` masks every
  payload per seat; `evaluate()` runs only on the server.
- **Adding mini-game #6..#31**: write one `MiniGameDefinition` in
  `packages/shared/src/minigames/`, register it in `registry.ts`, add one React
  renderer in `apps/web/src/minigames/` and register it in `index.ts`. No engine,
  networking or UI shell changes required.
- Player identity is a localStorage id **plus an HMAC token** issued by the
  server, so a client cannot claim another player's profile or leaderboard rows.
- Co-op is not Versus with different copy: games use `coopStyle`
  (`split` / `mirror` / `shared`) to hand each seat half the information.

## Testing two players locally

Open the app in two browser profiles (or a phone on the same Wi-Fi via the
network URL Vite prints). The client auto-targets the server on
`<current-host>:4000`, so LAN play works with no configuration.
