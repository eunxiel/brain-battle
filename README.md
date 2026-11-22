# BRAIN BATTLE

**Think Fast. Play Smart. Win Together.**

A real-time multiplayer brain-training arena. Two players, twelve rounds, three
lives, five mini-games that escalate in difficulty — played head-to-head or as a
team where each player only sees half of the puzzle.

---

## Features

**Two genuinely different modes**

- **Versus** — identical puzzle, identical difficulty, same second. Faster and
  more accurate answers score more; a miss costs a life.
- **Co-op** — not a re-skin of Versus. Information is physically split across the
  two devices, so the mode cannot be solved without talking:

  | Mini-game | What co-op changes |
  | --- | --- |
  | Memory Grid | You each watch one half of the sequence, both must reproduce all of it |
  | Bigger Number | Cards are dealt between you; pick yours, or declare your partner's is bigger |
  | Odd One Out | Two near-identical boards — the single tile that differs *between screens* is the answer |
  | Stop The Bar | Your own target zone is invisible; only your partner can see it, and vice versa |
  | Sequence | Half the terms are on your screen, half on theirs |

**Multiplayer** — private rooms with 5-character codes, random matchmaking
queues per mode, ready-up flow, host controls, disconnect detection with a
30-second reconnect grace window and mid-match resume.

**Progression** — profiles with selectable avatars, XP and levels, 10
achievements, match history, and daily / weekly / all-time leaderboards.

**Solo Daily Challenge** — a deterministic 12-round line-up that is identical for
every player worldwide on a given day, with streak tracking.

---

## Tech stack

| Layer | Stack |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4, Framer Motion, Zustand |
| Backend | Node.js, Express 5, Socket.IO 4 |
| Database | PostgreSQL, with a zero-config file store fallback |

No image or audio assets: avatars are generated SVG, icons are lucide, and sound
effects are synthesised with the Web Audio API.

---

## Quick start

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- Server: http://localhost:4000

To play multiplayer, open the app in two browsers — or on a phone using the LAN
address Vite prints. The client targets the server on `<current-host>:4000`, so
cross-device play needs no configuration.

### Configuration

Copy `.env.example` to `.env`:

```ini
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL=postgres://postgres:postgres@localhost:5432/brain_battle
```

`DATABASE_URL` is optional. When it is absent — or the connection fails — the
server falls back to a JSON file store in `apps/server/.data/` so the game stays
fully playable. Both paths implement the same `Store` interface, and the Postgres
schema applies itself on boot.

---

## Deployment

**One service, one URL.** After `npm run build`, the server also serves
`apps/web/dist`, so the interface and the match engine share an origin:

```bash
npm run build && npm start      # http://localhost:4000 — the whole game
```

Nothing has to be told where anything else is. The client talks to its own
origin, so there is no `VITE_SERVER_URL` to bake in and no `CLIENT_ORIGIN`
allowlist to keep in sync.

`render.yaml` is a ready blueprint for exactly this (Render → New → Blueprint);
any host that runs a persistent Node process works the same way. Static hosts
(Vercel, GitHub Pages, Netlify) can host the client but **cannot** host the
engine: it holds per-match state in memory and keeps WebSockets open for the
length of a match, which serverless and static hosting cannot do.

| Variable | |
| --- | --- |
| `SESSION_SECRET` | sign HMAC player tokens; keep it stable or every player is logged out on restart |
| `DATABASE_URL` | optional; without it, data resets whenever the host restarts |
| `CLIENT_ORIGIN` | **only** for split hosting — the origin of a separately hosted client |
| `VITE_SERVER_URL` | **only** for split hosting — baked in at build time, so changing it needs a rebuild |

Splitting the two across different hosts still works, but it is the harder
path: both variables above must then agree exactly, down to the trailing slash.

---

## Architecture

```
packages/shared/   types, socket event contracts, seeded RNG, scoring,
                   and the mini-game definitions (generate / mask / evaluate)
apps/server/       Express + Socket.IO, authoritative match engine, data stores
apps/web/          React client: design system, pages, mini-game renderers
```

### The server is authoritative

Clients never compute scores and never hold a solution before a round closes.
Every mini-game implements one interface:

```ts
interface MiniGameDefinition<TPayload, TAnswer> {
  generate(ctx): TPayload;                      // server only
  viewFor(payload, slot, mode): unknown;        // strips solutions, applies co-op splits
  evaluate(payload, answer, slot, mode, ctx);   // server only
  isValidAnswer(answer): answer is TAnswer;     // shape guard on untrusted input
}
```

`Stop The Bar` reports *when* the player pressed stop, never *where* the marker
was; the server replays the motion itself and rejects timestamps that drift
beyond the latency window. Player ids are paired with an HMAC token, so a client
cannot adopt another player's profile or leaderboard entries.

### Adding mini-game #6

1. Write a `MiniGameDefinition` in `packages/shared/src/minigames/`
2. Register it in `registry.ts`
3. Add a React renderer in `apps/web/src/minigames/` and register it in `index.ts`

No changes to the match engine, networking layer or UI shell are required.

---

## Testing

```bash
npm run typecheck
npm run smoke --workspace @brain-battle/server   # requires the dev server running
```

The smoke test drives a full Versus match, a full Co-op match and a Daily
Challenge run through real Socket.IO connections using only the data a client
actually receives. Alongside the gameplay assertions it scans every round
payload for leaked solution fields, and verifies that a forged session token
cannot claim another player's id.

---

## Licence

MIT
