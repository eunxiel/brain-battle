/** Match-wide rules shared by client and server. */
export const TOTAL_ROUNDS = 12;
export const STARTING_LIVES = 3;

/** Timing of the round state machine (milliseconds). */
export const ROUND_INTRO_MS = 2600;
export const ROUND_RESULT_MS = 2200;
export const MATCH_COUNTDOWN_MS = 3200;

/** How long a disconnected player may stay in a live match before forfeiting. */
export const RECONNECT_GRACE_MS = 30_000;

/** Room codes are 5 chars from an unambiguous alphabet (no O/0/I/1). */
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const MIN_USERNAME_LENGTH = 2;
export const MAX_USERNAME_LENGTH = 14;

/**
 * Difficulty ramps linearly from 1 (round 1) to 10 (round 12).
 * Every mini-game reads this single number and scales itself.
 */
export function difficultyForRound(roundIndex: number): number {
  const clamped = Math.max(0, Math.min(TOTAL_ROUNDS - 1, roundIndex));
  return 1 + (clamped * 9) / (TOTAL_ROUNDS - 1);
}

/** XP needed to reach the next level grows gently. */
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
}

export function xpForLevel(level: number): number {
  return Math.pow(Math.max(0, level - 1), 2) * 120;
}
