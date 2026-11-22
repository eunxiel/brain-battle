import type { MiniGameDefinition } from './types.js';

export interface MemoryGridPayload {
  size: number;
  sequence: number[];
  flashMs: number;
  gapMs: number;
  inputMs: number;
  /** Co-op split: the slice of the sequence a given seat is allowed to watch. */
  splitAt: number | null;
}

export interface MemoryGridView {
  size: number;
  /** Only the steps this seat may watch. */
  visibleSteps: number[];
  /** Position of the first visible step inside the full sequence (1-based). */
  stepOffset: number;
  /** Total length of the full sequence — both seats must reproduce all of it. */
  totalSteps: number;
  flashMs: number;
  gapMs: number;
  inputMs: number;
  split: boolean;
}

export type MemoryGridAnswer = number[];

function sequenceLength(difficulty: number): number {
  return Math.round(3 + difficulty * 0.62); // 4 -> 9
}

function gridSize(difficulty: number): number {
  if (difficulty < 3.5) return 3;
  if (difficulty < 7) return 4;
  return 5;
}

function flashDuration(difficulty: number): number {
  return Math.round(600 - difficulty * 32); // 568ms -> 280ms
}

export const memoryGrid: MiniGameDefinition<MemoryGridPayload, MemoryGridAnswer> = {
  id: 'memory-grid',
  title: 'Memory Grid',
  tagline: 'Watch. Remember. Repeat.',
  instruction: 'Memorise the tiles as they light up, then tap them back in the exact same order.',
  coopInstruction:
    'You each see only HALF of the sequence. Call out your half, then both tap the full order.',
  category: 'memory',
  accent: 'violet',
  icon: 'grid',
  coopStyle: 'split',

  durationMs(difficulty, mode) {
    const len = sequenceLength(difficulty);
    const flash = flashDuration(difficulty);
    const reveal = len * (flash + 170) + 600;
    const input = 1600 + len * 620;
    return Math.round(reveal + input + (mode === 'coop' ? 3000 : 0));
  },

  generate({ difficulty, rng, mode }) {
    const size = gridSize(difficulty);
    const cells = size * size;
    const length = sequenceLength(difficulty);
    const sequence: number[] = [];
    let previous = -1;
    for (let i = 0; i < length; i++) {
      let tile = rng.int(0, cells - 1);
      // Avoid immediate repeats: they read as a single long flash.
      let guard = 0;
      while (tile === previous && guard++ < 8) tile = rng.int(0, cells - 1);
      previous = tile;
      sequence.push(tile);
    }
    const flashMs = flashDuration(difficulty);
    return {
      size,
      sequence,
      flashMs,
      gapMs: 170,
      inputMs: 1600 + length * 620,
      splitAt: mode === 'coop' ? Math.ceil(length / 2) : null,
    };
  },

  viewFor(payload, slot, mode): MemoryGridView {
    const base = {
      size: payload.size,
      totalSteps: payload.sequence.length,
      flashMs: payload.flashMs,
      gapMs: payload.gapMs,
      inputMs: payload.inputMs,
    };
    if (mode !== 'coop' || payload.splitAt === null) {
      return { ...base, visibleSteps: payload.sequence, stepOffset: 1, split: false };
    }
    const splitAt = payload.splitAt;
    return slot === 'A'
      ? { ...base, visibleSteps: payload.sequence.slice(0, splitAt), stepOffset: 1, split: true }
      : {
          ...base,
          visibleSteps: payload.sequence.slice(splitAt),
          stepOffset: splitAt + 1,
          split: true,
        };
  },

  solutionFor(payload) {
    return payload.sequence;
  },

  isValidAnswer(answer): answer is MemoryGridAnswer {
    return (
      Array.isArray(answer) &&
      answer.length <= 32 &&
      answer.every((v) => Number.isInteger(v) && v >= 0 && v < 64)
    );
  },

  evaluate(payload, answer) {
    const target = payload.sequence;
    let matched = 0;
    for (let i = 0; i < target.length; i++) {
      if (answer[i] === target[i]) matched++;
      else break;
    }
    const correct = answer.length === target.length && matched === target.length;
    return { correct, accuracy: correct ? 1 : matched / target.length };
  },
};
