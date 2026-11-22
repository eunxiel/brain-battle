import type { Rng } from '../rng.js';
import type { GameMode, PlayerSlot } from '../types.js';

export type MiniGameId =
  | 'memory-grid'
  | 'bigger-number'
  | 'odd-one-out'
  | 'stop-the-bar'
  | 'sequence';

export type MiniGameCategory =
  | 'memory'
  | 'reaction'
  | 'logic'
  | 'math'
  | 'observation'
  | 'focus';

/**
 * How a game behaves in CO-OP.
 *  - shared : identical puzzle, both players solve it, sync bonus for a double hit.
 *  - split  : each seat receives half of the information and must talk to solve it.
 *  - mirror : the two seats get *almost* identical boards; the difference is the answer.
 */
export type CoopStyle = 'shared' | 'split' | 'mirror';

export type AccentKey = 'violet' | 'coral' | 'sun' | 'mint' | 'sky';

export interface MiniGameContext {
  /** 1 (round 1) .. 10 (round 12) */
  difficulty: number;
  mode: GameMode;
  rng: Rng;
}

export interface MiniGameEvaluation {
  correct: boolean;
  /** 0..1 — partial credit for precision-based games. */
  accuracy: number;
}

/**
 * The contract every mini-game implements. Adding game #6..#31 means writing
 * one of these plus one React renderer — no changes to the engine, the match
 * loop, the networking layer or the UI shell.
 */
export interface MiniGameDefinition<TPayload = unknown, TAnswer = unknown> {
  readonly id: MiniGameId;
  readonly title: string;
  readonly tagline: string;
  readonly instruction: string;
  readonly coopInstruction: string;
  readonly category: MiniGameCategory;
  readonly accent: AccentKey;
  readonly icon: string;
  readonly coopStyle: CoopStyle;

  /** Total time the player gets, already scaled by difficulty. */
  durationMs(difficulty: number, mode: GameMode): number;

  /** Server-only. Builds the authoritative puzzle. */
  generate(ctx: MiniGameContext): TPayload;

  /**
   * Server-only. Produces the object actually sent to a given seat:
   * strips solutions and applies co-op information splits.
   */
  viewFor(payload: TPayload, slot: PlayerSlot, mode: GameMode): unknown;

  /** Server-only. The authoritative answer, revealed after the round closes. */
  solutionFor(payload: TPayload, slot: PlayerSlot, mode: GameMode): unknown;

  /** Shape guard — never evaluate unvalidated client input. */
  isValidAnswer(answer: unknown): answer is TAnswer;

  /** Server-only. Grades a submitted answer. */
  evaluate(
    payload: TPayload,
    answer: TAnswer,
    slot: PlayerSlot,
    mode: GameMode,
    context: { elapsedMs: number; durationMs: number },
  ): MiniGameEvaluation;
}

/** Convenience: an unknown-typed definition for registry storage. */
export type AnyMiniGame = MiniGameDefinition<any, any>;
