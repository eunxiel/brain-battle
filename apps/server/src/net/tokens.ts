import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SECRET_FILE = resolve(HERE, '../../.data/session.secret');

let secret: Buffer = randomBytes(32);

/**
 * Player ids live in localStorage, so a bare id is a claim, not a proof.
 * Every id is paired with an HMAC so one client cannot adopt another's
 * profile, stats or leaderboard entries.
 */
export async function loadSessionSecret(): Promise<void> {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv) {
    secret = Buffer.from(fromEnv, 'utf8');
    return;
  }
  try {
    secret = Buffer.from(await readFile(SECRET_FILE, 'utf8'), 'hex');
    if (secret.length < 16) throw new Error('secret too short');
  } catch {
    secret = randomBytes(32);
    await mkdir(dirname(SECRET_FILE), { recursive: true });
    await writeFile(SECRET_FILE, secret.toString('hex'), 'utf8');
  }
}

export function signPlayerId(playerId: string): string {
  return createHmac('sha256', secret).update(playerId).digest('base64url');
}

export function verifyPlayerToken(playerId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(signPlayerId(playerId));
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
