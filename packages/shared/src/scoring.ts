/** Scoring lives here so the server can grade and the client can explain. */

export interface ScoreInput {
  difficulty: number;
  /** Time taken, milliseconds. */
  responseMs: number;
  durationMs: number;
  /** 0..1 partial credit from the mini-game. */
  accuracy: number;
  /** Consecutive correct answers *before* this one. */
  streak: number;
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  streakBonus: number;
  total: number;
}

export const SYNC_BONUS = 50;
export const MAX_STREAK_BONUS_STEPS = 5;

export function computeRoundScore(input: ScoreInput): ScoreBreakdown {
  const base = Math.round((60 + input.difficulty * 14) * input.accuracy);
  const timeLeft = Math.max(0, 1 - input.responseMs / Math.max(1, input.durationMs));
  const speedBonus = Math.round(base * 0.6 * timeLeft);
  const streakBonus = Math.min(input.streak, MAX_STREAK_BONUS_STEPS) * 15;
  return { base, speedBonus, streakBonus, total: base + speedBonus + streakBonus };
}

/** XP is score-derived so levelling tracks real performance. */
export function xpFromMatch(score: number, won: boolean, roundsPlayed: number): number {
  return Math.round(score * 0.25 + roundsPlayed * 6 + (won ? 120 : 30));
}
