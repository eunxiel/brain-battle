import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type {
  DailyChallengeState,
  LeaderboardEntry,
  LeaderboardPeriod,
  MatchHistoryEntry,
  PlayerProfile,
} from '@brain-battle/shared';
import { dailyPlan } from '../game/daily.js';
import { todayKey } from '../util/ids.js';
import { computeStreak, periodStart } from './fileStore.js';
import type { MatchRecord, Store } from './types.js';

const HERE = dirname(fileURLToPath(import.meta.url));

interface PlayerRow {
  id: string;
  username: string;
  avatar_id: string;
  xp: number;
  level: number;
  total_matches: number;
  wins: number;
  losses: number;
  draws: number;
  best_score: number;
  total_correct: number;
  total_wrong: number;
  avg_response_ms: number;
  achievements: string[];
  created_at: Date;
}

function toProfile(row: PlayerRow): PlayerProfile {
  return {
    id: row.id,
    username: row.username,
    avatarId: row.avatar_id,
    xp: row.xp,
    level: row.level,
    totalMatches: row.total_matches,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    bestScore: row.best_score,
    totalCorrect: row.total_correct,
    totalWrong: row.total_wrong,
    avgResponseMs: row.avg_response_ms,
    achievements: row.achievements ?? [],
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class PostgresStore implements Store {
  readonly kind = 'postgres' as const;
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      max: 10,
      ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }

  async init(): Promise<void> {
    const sql = await readFile(resolve(HERE, 'schema.sql'), 'utf8');
    await this.pool.query(sql);
  }

  async getProfile(id: string): Promise<PlayerProfile | null> {
    const { rows } = await this.pool.query<PlayerRow>('SELECT * FROM players WHERE id = $1', [id]);
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async upsertProfile(profile: PlayerProfile): Promise<PlayerProfile> {
    const { rows } = await this.pool.query<PlayerRow>(
      `INSERT INTO players (id, username, avatar_id, xp, level, total_matches, wins, losses, draws,
                            best_score, total_correct, total_wrong, avg_response_ms, achievements, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         avatar_id = EXCLUDED.avatar_id,
         xp = EXCLUDED.xp,
         level = EXCLUDED.level,
         total_matches = EXCLUDED.total_matches,
         wins = EXCLUDED.wins,
         losses = EXCLUDED.losses,
         draws = EXCLUDED.draws,
         best_score = EXCLUDED.best_score,
         total_correct = EXCLUDED.total_correct,
         total_wrong = EXCLUDED.total_wrong,
         avg_response_ms = EXCLUDED.avg_response_ms,
         achievements = EXCLUDED.achievements
       RETURNING *`,
      [
        profile.id,
        profile.username,
        profile.avatarId,
        profile.xp,
        profile.level,
        profile.totalMatches,
        profile.wins,
        profile.losses,
        profile.draws,
        profile.bestScore,
        profile.totalCorrect,
        profile.totalWrong,
        profile.avgResponseMs,
        profile.achievements,
        profile.createdAt,
      ],
    );
    return toProfile(rows[0] as PlayerRow);
  }

  async recordMatch(record: MatchRecord): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO matches (id, mode, solo, rounds_played, played_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [record.matchId, record.mode, record.solo, record.roundsPlayed, record.playedAt],
      );
      for (const p of record.players) {
        await client.query(
          `INSERT INTO match_players (match_id, player_id, score, correct, wrong, best_streak,
                                      avg_response_ms, lives_left, outcome, opponent_name,
                                      opponent_avatar, xp_gained, played_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (match_id, player_id) DO NOTHING`,
          [
            record.matchId,
            p.playerId,
            p.score,
            p.correct,
            p.wrong,
            p.bestStreak,
            p.avgResponseMs,
            p.livesLeft,
            p.outcome,
            p.opponentName,
            p.opponentAvatarId,
            p.xpGained,
            record.playedAt,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getHistory(playerId: string, limit = 20): Promise<MatchHistoryEntry[]> {
    const { rows } = await this.pool.query(
      `SELECT mp.match_id, m.mode, mp.score, mp.opponent_name, mp.opponent_avatar,
              mp.outcome, mp.correct, mp.wrong, mp.played_at
         FROM match_players mp JOIN matches m ON m.id = mp.match_id
        WHERE mp.player_id = $1
        ORDER BY mp.played_at DESC
        LIMIT $2`,
      [playerId, limit],
    );
    return rows.map((r) => ({
      matchId: r.match_id,
      mode: r.mode,
      score: r.score,
      opponentName: r.opponent_name,
      opponentAvatarId: r.opponent_avatar,
      outcome: r.outcome,
      correct: r.correct,
      wrong: r.wrong,
      playedAt: new Date(r.played_at).toISOString(),
    }));
  }

  async getLeaderboard(period: LeaderboardPeriod, limit = 50): Promise<LeaderboardEntry[]> {
    const since = periodStart(period);
    const { rows } = await this.pool.query(
      `SELECT mp.player_id, MAX(mp.score) AS score, COUNT(*) AS matches,
              COUNT(*) FILTER (WHERE mp.outcome IN ('win','team-win')) AS wins,
              p.username, p.avatar_id, p.level
         FROM match_players mp JOIN players p ON p.id = mp.player_id
        WHERE ($1::timestamptz IS NULL OR mp.played_at >= $1)
        GROUP BY mp.player_id, p.username, p.avatar_id, p.level
        ORDER BY score DESC
        LIMIT $2`,
      [since, limit],
    );
    return rows.map((r, index) => ({
      rank: index + 1,
      playerId: r.player_id,
      username: r.username,
      avatarId: r.avatar_id,
      level: r.level,
      score: Number(r.score),
      matches: Number(r.matches),
      wins: Number(r.wins),
    }));
  }

  async getDaily(playerId: string): Promise<DailyChallengeState> {
    const dateKey = todayKey();
    const { rows } = await this.pool.query(
      `SELECT date_key, best_score FROM daily_runs
        WHERE player_id = $1 AND date_key > CURRENT_DATE - INTERVAL '400 days'
        ORDER BY date_key DESC`,
      [playerId],
    );
    const keys = rows.map((r) => new Date(r.date_key).toISOString().slice(0, 10));
    const today = rows.find((r) => new Date(r.date_key).toISOString().slice(0, 10) === dateKey);
    return {
      dateKey,
      gameIds: dailyPlan(dateKey),
      bestScore: today ? Number(today.best_score) : 0,
      completed: Boolean(today),
      streak: computeStreak(keys, dateKey),
    };
  }

  async recordDaily(playerId: string, score: number): Promise<DailyChallengeState> {
    await this.pool.query(
      `INSERT INTO daily_runs (player_id, date_key, best_score)
       VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (player_id, date_key)
       DO UPDATE SET best_score = GREATEST(daily_runs.best_score, EXCLUDED.best_score),
                     updated_at = now()`,
      [playerId, score],
    );
    return this.getDaily(playerId);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
