import { config } from '../config.js';
import { FileStore } from './fileStore.js';
import { PostgresStore } from './postgresStore.js';
import type { Store } from './types.js';

export type { Store, MatchRecord, MatchRecordPlayer } from './types.js';

/**
 * Postgres is the production store. If it is not configured — or not reachable —
 * the server degrades to a file-backed store instead of refusing to boot.
 */
export async function createStore(): Promise<Store> {
  if (config.databaseUrl) {
    const store = new PostgresStore(config.databaseUrl);
    try {
      await store.init();
      console.log('[store] connected to PostgreSQL');
      return store;
    } catch (error) {
      await store.close().catch(() => undefined);
      console.warn(
        `[store] PostgreSQL unavailable (${(error as Error).message}) — falling back to file store`,
      );
    }
  } else {
    console.log('[store] DATABASE_URL not set — using local file store');
  }
  const fallback = new FileStore();
  await fallback.init();
  return fallback;
}
