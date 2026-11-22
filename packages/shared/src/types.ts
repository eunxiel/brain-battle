import type { MiniGameId } from './minigames/types.js';

export type GameMode = 'versus' | 'coop';

/** Seat in a room. Co-op split-information games key their views off this. */
export type PlayerSlot = 'A' | 'B';

export interface PlayerProfile {
  id: string;
  username: string;
  avatarId: string;
  xp: number;
  level: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  bestScore: number;
  totalCorrect: number;
  totalWrong: number;
  avgResponseMs: number;
  achievements: string[];
  createdAt: string;
}

export interface PublicPlayer {
  id: string;
  username: string;
  avatarId: string;
  level: number;
  slot: PlayerSlot;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
}

export type RoomStatus = 'lobby' | 'countdown' | 'in-match' | 'finished';

export interface RoomState {
  code: string;
  mode: GameMode;
  status: RoomStatus;
  hostId: string;
  players: PublicPlayer[];
  isPrivate: boolean;
}

export interface MatchPlayerState {
  playerId: string;
  slot: PlayerSlot;
  score: number;
  lives: number;
  correct: number;
  wrong: number;
  streak: number;
  bestStreak: number;
  avgResponseMs: number;
  answeredThisRound: boolean;
  eliminated: boolean;
}

export type MatchPhase = 'countdown' | 'intro' | 'playing' | 'result' | 'ended';

export interface MatchSnapshot {
  matchId: string;
  mode: GameMode;
  roundIndex: number;
  totalRounds: number;
  phase: MatchPhase;
  players: MatchPlayerState[];
  /** Co-op only: shared hearts and shared team score. */
  teamLives: number | null;
  teamScore: number | null;
}

export interface RoundMeta {
  roundIndex: number;
  gameId: MiniGameId;
  title: string;
  instruction: string;
  /** Co-op variant instruction shown instead of `instruction` when relevant. */
  coopInstruction?: string;
  category: string;
  accent: string;
  icon: string;
  difficulty: number;
  durationMs: number;
  startsAt: number;
}

export interface RoundStartPayload {
  roundIndex: number;
  /** Already masked for the receiving player in co-op split games. */
  payload: unknown;
  durationMs: number;
  startsAt: number;
  deadline: number;
}

export interface PlayerRoundOutcome {
  playerId: string;
  answered: boolean;
  correct: boolean;
  accuracy: number;
  responseMs: number | null;
  points: number;
  livesLost: number;
}

export interface RoundResultPayload {
  roundIndex: number;
  outcomes: PlayerRoundOutcome[];
  /** The authoritative solution, revealed only after the round closes. */
  solution: unknown;
  syncBonus: number;
  snapshot: MatchSnapshot;
  nextRoundAt: number | null;
}

export type MatchEndReason = 'completed' | 'lives' | 'forfeit' | 'disconnect';

export interface MatchResultPlayer {
  playerId: string;
  username: string;
  avatarId: string;
  slot: PlayerSlot;
  score: number;
  correct: number;
  wrong: number;
  bestStreak: number;
  avgResponseMs: number;
  livesLeft: number;
  xpGained: number;
}

export interface MatchResult {
  matchId: string;
  mode: GameMode;
  reason: MatchEndReason;
  roundsPlayed: number;
  /** Versus: winning player id, or null on a draw. */
  winnerId: string | null;
  /** Co-op: did the team survive all 12 rounds? */
  teamVictory: boolean | null;
  teamScore: number | null;
  players: MatchResultPlayer[];
  unlockedAchievements: string[];
  finishedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  avatarId: string;
  level: number;
  score: number;
  matches: number;
  wins: number;
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all-time';

export interface MatchHistoryEntry {
  matchId: string;
  mode: GameMode;
  score: number;
  opponentName: string;
  opponentAvatarId: string;
  outcome: 'win' | 'loss' | 'draw' | 'team-win' | 'team-loss';
  correct: number;
  wrong: number;
  playedAt: string;
}

export interface DailyChallengeState {
  dateKey: string;
  /** Rotating mini-game line-up for today's solo run. */
  gameIds: MiniGameId[];
  bestScore: number;
  completed: boolean;
  streak: number;
}
