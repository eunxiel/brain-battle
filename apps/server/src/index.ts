import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@brain-battle/shared';
import { config } from './config.js';
import { createStore } from './db/index.js';
import { ProfileService } from './game/profiles.js';
import { GameServer } from './net/gameServer.js';
import { loadSessionSecret } from './net/tokens.js';

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

  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: config.isProduction ? config.clientOrigins : true, credentials: true },
    pingTimeout: 20_000,
    pingInterval: 10_000,
  });

  const game = new GameServer(io, store, profiles);
  io.on('connection', (socket) => game.handleConnection(socket));

  httpServer.listen(config.port, () => {
    console.log(`[brain-battle] server ready on http://localhost:${config.port}`);
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
