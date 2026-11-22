import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  DailyChallengeState,
  LeaderboardEntry,
  LeaderboardPeriod,
  MatchHistoryEntry,
  PlayerProfile,
} from '@brain-battle/shared';
import { dailyPlan } from '../game/daily.js';
import { todayKey } from '../util/ids.js';
import type { MatchRecord, MatchRecordPlayer, Store } from './types.js';

interface ScoreRow extends MatchRecordPlayer {
  matchId: string;
  mode: MatchRecord['mode'];
  playedAt: string;
}

interface DailyRow {
  playerId: string;
  dateKey: string;
  bestScore: number;
}

interface FileData {
  profiles: Record<string, PlayerProfile>;
  scores: ScoreRow[];
  daily: DailyRow[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(HERE, '../../.data/store.json');

/**
 * Zero-config persistence used when DATABASE_URL is not configured.
 * Same contract as the Postgres store, so the game is fully playable offline.
 */
export class FileStore implements Store {
  readonly kind = 'file' as const;
  private data: FileData = { profiles: {}, scores: [], daily: [] };
  private writeTimer: NodeJS.Timeout | null = null;
  private writing: Promise<void> = Promise.resolve();

  async init(): Promise<void> {
    await mkdir(dirname(DATA_FILE), { recursive: true });
    try {
      const raw = await readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<FileData>;
      this.data = {
        profiles: parsed.profiles ?? {},
        scores: parsed.scores ?? [],
        daily: parsed.daily ?? [],
      };
    } catch {
      await this.flush();
    }
  }

  private schedule(): void {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      void this.flush();
    }, 400);
  }

  private async flush(): Promise<void> {
    this.writing = this.writing.then(() =>
      writeFile(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8').catch((err) =>
        console.error('[store] write failed', err),
      ),
    );
    return this.writing;
  }

  async getProfile(id: string): Promise<PlayerProfile | null> {
    return this.data.profiles[id] ?? null;
  }

  async upsertProfile(profile: PlayerProfile): Promise<PlayerProfile> {
    this.data.profiles[profile.id] = profile;
    this.schedule();
    return profile;
  }

  async recordMatch(record: MatchRecord): Promise<void> {
    for (const player of record.players) {
      this.data.scores.push({
        ...player,
        matchId: record.matchId,
        mode: record.mode,
        playedAt: record.playedAt,
      });
    }
    if (this.data.scores.length > 20_000) {
      this.data.scores = this.data.scores.slice(-15_000);
    }
    this.schedule();
  }

  async getHistory(playerId: string, limit = 20): Promise<MatchHistoryEntry[]> {
    return this.data.scores
      .filter((s) => s.playerId === playerId)
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
      .slice(0, limit)
      .map((s) => ({
        matchId: s.matchId,
        mode: s.mode,
        score: s.score,
        opponentName: s.opponentName,
        opponentAvatarId: s.opponentAvatarId,
        outcome: s.outcome,
        correct: s.correct,
        wrong: s.wrong,
        playedAt: s.playedAt,
      }));
  }

  async getLeaderboard(period: LeaderboardPeriod, limit = 50): Promise<LeaderboardEntry[]> {
    const since = periodStart(period);
    const best = new Map<string, { score: number; matches: number; wins: number }>();
    for (const row of this.data.scores) {
      if (since && new Date(row.playedAt) < since) continue;
      const current = best.get(row.playerId) ?? { score: 0, matches: 0, wins: 0 };
      current.score = Math.max(current.score, row.score);
      current.matches += 1;
      if (row.outcome === 'win' || row.outcome === 'team-win') current.wins += 1;
      best.set(row.playerId, current);
    }
    return [...best.entries()]
      .map(([playerId, stats]) => {
        const profile = this.data.profiles[playerId];
        return {
          rank: 0,
          playerId,
          username: profile?.username ?? 'Player',
          avatarId: profile?.avatarId ?? 'nova',
          level: profile?.level ?? 1,
          score: stats.score,
          matches: stats.matches,
          wins: stats.wins,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  async getDaily(playerId: string): Promise<DailyChallengeState> {
    const dateKey = todayKey();
    const rows = this.data.daily.filter((d) => d.playerId === playerId);
    const today = rows.find((d) => d.dateKey === dateKey);
    return {
      dateKey,
      gameIds: dailyPlan(dateKey),
      bestScore: today?.bestScore ?? 0,
      completed: Boolean(today),
      streak: computeStreak(rows.map((r) => r.dateKey), dateKey),
    };
  }

  async recordDaily(playerId: string, score: number): Promise<DailyChallengeState> {
    const dateKey = todayKey();
    const existing = this.data.daily.find((d) => d.playerId === playerId && d.dateKey === dateKey);
    if (existing) existing.bestScore = Math.max(existing.bestScore, score);
    else this.data.daily.push({ playerId, dateKey, bestScore: score });
    this.schedule();
    return this.getDaily(playerId);
  }

  async close(): Promise<void> {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    await this.flush();
  }
}

export function periodStart(period: LeaderboardPeriod): Date | null {
  if (period === 'all-time') return null;
  const now = new Date();
  if (period === 'daily') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 7);
  return start;
}

export function computeStreak(dateKeys: string[], todayKeyValue: string): number {
  const set = new Set(dateKeys);
  let streak = 0;
  const cursor = new Date(`${todayKeyValue}T00:00:00.000Z`);
  // Today is optional: a streak stays alive until the day is actually missed.
  if (!set.has(todayKeyValue)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
