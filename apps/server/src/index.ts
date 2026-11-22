import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@brain-battle/shared';
import { config } from './config.js';
import { createStore } from './db/index.js';
import { ProfileService } from './game/profiles.js';
import { GameServer } from './net/gameServer.js';
import { loadSessionSecret } from './net/tokens.js';

const WEB_DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');

/**
 * Same site, same port. Two origins meant the client had to be told where its
 * server lived (`VITE_SERVER_URL`), and the server had to be told which client
 * to trust (`CLIENT_ORIGIN`) — two settings that silently break the game when
 * they disagree. Serving the built client from here collapses both into one
 * deployment with nothing to configure.
 */
function serveWebClient(app: express.Express): boolean {
  if (!existsSync(join(WEB_DIST, 'index.html'))) return false;
  app.use(express.static(WEB_DIST));
  // Client-side routing: every unknown GET is a route, not a missing file.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(join(WEB_DIST, 'index.html'));
  });
  return true;
}

/** A page served by this very server is always allowed to talk to it. */
function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  await loadSessionSecret();
  const store = await createStore();
  const profiles = new ProfileService(store);

  const app = express();
  app.use(cors({ origin: config.isProduction ? config.clientOrigins : true }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, store: store.kind, uptime: process.uptime() });
  });

  app.get('/api/leaderboard/:period', async (req, res) => {
    const period = req.params.period;
    if (period !== 'daily' && period !== 'weekly' && period !== 'all-time') {
      res.status(400).json({ error: 'invalid period' });
      return;
    }
    res.json(await store.getLeaderboard(period, 50));
  });

  // Registered last: the SPA fallback must not shadow /health or /api.
  const servingClient = serveWebClient(app);

  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: config.isProduction ? config.clientOrigins : true, credentials: true },
    // `cors` alone is not an allowlist. Browsers do not apply the same-origin
    // policy to WebSocket upgrades, so it only ever shielded the long-polling
    // transport — and the client asks for `websocket` first. Without this check
    // any page on the internet could drive a visitor's browser into our match
    // engine. An absent Origin is a non-browser client (smoke test, uptime
    // probe); those can forge the header anyway, so there is nothing to gain by
    // refusing them.
    allowRequest: (req, done) => {
      const origin = req.headers.origin;
      const allowed =
        !config.isProduction ||
        !origin ||
        isSameOrigin(origin, req.headers.host) ||
        config.clientOrigins.includes(origin);
      done(allowed ? null : 'origin not allowed', allowed);
    },
    pingTimeout: 20_000,
    pingInterval: 10_000,
  });

  const game = new GameServer(io, store, profiles);
  io.on('connection', (socket) => game.handleConnection(socket));

  httpServer.listen(config.port, () => {
    console.log(`[brain-battle] server ready on http://localhost:${config.port}`);
    console.log(
      servingClient
        ? '[brain-battle] serving the web client from the same port — open that URL to play'
        : '[brain-battle] api only (no apps/web/dist build found — run `npm run build` to serve the client too)',
    );
  });

  const shutdown = async (): Promise<void> => {
    console.log('\n[brain-battle] shutting down');
    game.dispose();
    io.close();
    httpServer.close();
    await store.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error('[brain-battle] fatal startup error', error);
  process.exit(1);
});
