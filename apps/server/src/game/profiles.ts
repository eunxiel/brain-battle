import {
  DEFAULT_AVATAR_ID,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  getAvatar,
  levelForXp,
  randomUsername,
  type PlayerProfile,
} from '@brain-battle/shared';
import type { Store } from '../db/index.js';
import { newId } from '../util/ids.js';

export function sanitizeUsername(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.replace(/\s+/g, ' ').trim().slice(0, MAX_USERNAME_LENGTH);
  if (trimmed.length < MIN_USERNAME_LENGTH) return null;
  // Keep it printable and chat-safe.
  if (!/^[\p{L}\p{N} _.-]+$/u.test(trimmed)) return null;
  return trimmed;
}

export function emptyProfile(id = newId()): PlayerProfile {
  return {
    id,
    username: randomUsername(),
    avatarId: DEFAULT_AVATAR_ID,
    xp: 0,
    level: 1,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    bestScore: 0,
    totalCorrect: 0,
    totalWrong: 0,
    avgResponseMs: 0,
    achievements: [],
    createdAt: new Date().toISOString(),
  };
}

export class ProfileService {
  private cache = new Map<string, PlayerProfile>();

  constructor(private store: Store) {}

  async resolve(
    playerId: string | null,
    hints: { username?: string; avatarId?: string },
  ): Promise<PlayerProfile> {
    const existing = playerId ? await this.get(playerId) : null;
    if (existing) return existing;

    const profile = emptyProfile(playerId ?? undefined);
    const username = sanitizeUsername(hints.username);
    if (username) profile.username = username;
    if (hints.avatarId) profile.avatarId = getAvatar(hints.avatarId).id;
    return this.save(profile);
  }

  async get(playerId: string): Promise<PlayerProfile | null> {
    const cached = this.cache.get(playerId);
    if (cached) return cached;
    const stored = await this.store.getProfile(playerId);
    if (stored) this.cache.set(playerId, stored);
    return stored;
  }

  async save(profile: PlayerProfile): Promise<PlayerProfile> {
    const normalised: PlayerProfile = { ...profile, level: levelForXp(profile.xp) };
    const saved = await this.store.upsertProfile(normalised);
    this.cache.set(saved.id, saved);
    return saved;
  }

  async update(
    playerId: string,
    patch: Partial<Pick<PlayerProfile, 'username' | 'avatarId'>>,
  ): Promise<PlayerProfile | null> {
    const profile = await this.get(playerId);
    if (!profile) return null;
    const next = { ...profile };
    if (patch.username) {
      const username = sanitizeUsername(patch.username);
      if (username) next.username = username;
    }
    if (patch.avatarId) next.avatarId = getAvatar(patch.avatarId).id;
    return this.save(next);
  }
}
