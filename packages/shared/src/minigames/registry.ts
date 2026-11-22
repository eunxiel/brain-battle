import type { Rng } from '../rng.js';
import { TOTAL_ROUNDS } from '../constants.js';
import { memoryGrid } from './memoryGrid.js';
import { biggerNumber } from './biggerNumber.js';
import { oddOneOut } from './oddOneOut.js';
import { stopTheBar } from './stopTheBar.js';
import { sequence } from './sequence.js';
import type { AnyMiniGame, MiniGameId } from './types.js';

/**
 * The single place a new mini-game is registered.
 * Target line-up is 31 games; these five are complete and production ready.
 */
export const MINI_GAMES: Record<MiniGameId, AnyMiniGame> = {
  'memory-grid': memoryGrid,
  'bigger-number': biggerNumber,
  'odd-one-out': oddOneOut,
  'stop-the-bar': stopTheBar,
  sequence: sequence,
};

export const MINI_GAME_LIST: AnyMiniGame[] = Object.values(MINI_GAMES);

export function getMiniGame(id: MiniGameId): AnyMiniGame {
  const game = MINI_GAMES[id];
  if (!game) throw new Error(`Unknown mini-game: ${id}`);
  return game;
}

export function isMiniGameId(value: unknown): value is MiniGameId {
  return typeof value === 'string' && value in MINI_GAMES;
}

/**
 * Builds the 12-round line-up: every game appears before any repeats and the
 * same game never lands twice in a row.
 */
export function buildRoundPlan(rng: Rng, rounds = TOTAL_ROUNDS): MiniGameId[] {
  const ids = MINI_GAME_LIST.map((g) => g.id);
  const plan: MiniGameId[] = [];
  while (plan.length < rounds) {
    let batch = rng.shuffle(ids);
    if (plan.length && batch[0] === plan[plan.length - 1]) {
      batch = [...batch.slice(1), batch[0] as MiniGameId];
    }
    plan.push(...batch.slice(0, Math.min(batch.length, rounds - plan.length)));
  }
  return plan;
}

export * from './types.js';
export * from './memoryGrid.js';
export * from './biggerNumber.js';
export * from './oddOneOut.js';
export * from './stopTheBar.js';
export * from './sequence.js';
