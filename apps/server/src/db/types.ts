import type {
  DailyChallengeState,
  GameMode,
  LeaderboardEntry,
  LeaderboardPeriod,
  MatchHistoryEntry,
  PlayerProfile,
} from '@brain-battle/shared';

export interface MatchRecordPlayer {
  playerId: string;
  score: number;
  correct: number;
  wrong: number;
  bestStreak: number;
  avgResponseMs: number;
  livesLeft: number;
  outcome: MatchHistoryEntry['outcome'];
  opponentName: string;
  opponentAvatarId: string;
  xpGained: number;
}

export interface MatchRecord {
  matchId: string;
  mode: GameMode;
  solo: boolean;
  roundsPlayed: number;
  playedAt: string;
  players: MatchRecordPlayer[];
}

export interface Store {
  readonly kind: 'postgres' | 'file';
  init(): Promise<void>;
  getProfile(id: string): Promise<PlayerProfile | null>;
  upsertProfile(profile: PlayerProfile): Promise<PlayerProfile>;
  recordMatch(record: MatchRecord): Promise<void>;
  getHistory(playerId: string, limit?: number): Promise<MatchHistoryEntry[]>;
  getLeaderboard(period: LeaderboardPeriod, limit?: number): Promise<LeaderboardEntry[]>;
  getDaily(playerId: string): Promise<DailyChallengeState>;
  recordDaily(playerId: string, score: number): Promise<DailyChallengeState>;
  close(): Promise<void>;
}
