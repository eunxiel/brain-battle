import type { Rng } from '../rng.js';
import type { MiniGameDefinition } from './types.js';

export interface SequencePayload {
  terms: number[];
  holeIndex: number;
  options: number[];
  ruleLabel: string;
  split: boolean;
  splitAt: number;
}

export interface SequenceCell {
  value: number | null;
  isHole: boolean;
  /** Co-op: this term is on your partner's screen. */
  hidden: boolean;
}

export interface SequenceView {
  cells: SequenceCell[];
  options: number[];
  split: boolean;
}

export type SequenceAnswer = number;

type RuleBuilder = (rng: Rng, length: number) => { terms: number[]; label: string };

const RULES: { minDifficulty: number; build: RuleBuilder }[] = [
  {
    minDifficulty: 0,
    build: (rng, length) => {
      const start = rng.int(1, 12);
      const step = rng.int(2, 9);
      return {
        terms: Array.from({ length }, (_, i) => start + i * step),
        label: `+${step} each step`,
      };
    },
  },
  {
    minDifficulty: 2,
    build: (rng, length) => {
      const start = rng.int(40, 99);
      const step = rng.int(3, 11);
      return {
        terms: Array.from({ length }, (_, i) => start - i * step),
        label: `-${step} each step`,
      };
    },
  },
  {
    minDifficulty: 3.5,
    build: (rng, length) => {
      const start = rng.int(2, 5);
      const ratio = rng.int(2, 3);
      return {
        terms: Array.from({ length }, (_, i) => start * Math.pow(ratio, i)),
        label: `x${ratio} each step`,
      };
    },
  },
  {
    minDifficulty: 4.5,
    build: (rng, length) => {
      const start = rng.int(1, 9);
      const up = rng.int(4, 12);
      const down = rng.int(1, 3);
      const terms = [start];
      for (let i = 1; i < length; i++) {
        terms.push((terms[i - 1] as number) + (i % 2 === 1 ? up : -down));
      }
      return { terms, label: `+${up}, -${down}, repeat` };
    },
  },
  {
    minDifficulty: 6,
    build: (rng, length) => {
      const a = rng.int(1, 6);
      const b = rng.int(a + 1, a + 7);
      const terms = [a, b];
      for (let i = 2; i < length; i++) {
        terms.push((terms[i - 1] as number) + (terms[i - 2] as number));
      }
      return { terms, label: 'add the two before it' };
    },
  },
  {
    minDifficulty: 7,
    build: (rng, length) => {
      const offset = rng.int(0, 4);
      return {
        terms: Array.from({ length }, (_, i) => Math.pow(i + 1 + offset, 2)),
        label: 'perfect squares',
      };
    },
  },
  {
    minDifficulty: 8,
    build: (rng, length) => {
      const start = rng.int(1, 7);
      const add = rng.int(1, 5);
      const terms = [start];
      for (let i = 1; i < length; i++) terms.push((terms[i - 1] as number) * 2 + add);
      return { terms, label: `double then +${add}` };
    },
  },
  {
    minDifficulty: 8.5,
    build: (rng, length) => {
      // Two interleaved arithmetic sequences.
      const a0 = rng.int(2, 15);
      const b0 = rng.int(20, 60);
      const da = rng.int(3, 9);
      const db = -rng.int(2, 7);
      const terms: number[] = [];
      for (let i = 0; i < length; i++) {
        terms.push(i % 2 === 0 ? a0 + (i / 2) * da : b0 + ((i - 1) / 2) * db);
      }
      return { terms, label: 'two sequences, interleaved' };
    },
  },
];

function buildOptions(rng: Rng, answer: number, difficulty: number): number[] {
  const options = new Set<number>([answer]);
  const spread = Math.max(2, Math.round(Math.abs(answer) * (0.3 - difficulty * 0.02)) || 3);
  let guard = 0;
  while (options.size < 4 && guard++ < 60) {
    const delta = rng.int(1, spread + 2) * (rng.bool() ? 1 : -1);
    const candidate = answer + delta;
    if (candidate !== answer && candidate > 0) options.add(candidate);
  }
  while (options.size < 4) options.add(answer + options.size * 3 + 1);
  return rng.shuffle([...options]);
}

export const sequence: MiniGameDefinition<SequencePayload, SequenceAnswer> = {
  id: 'sequence',
  title: 'Sequence',
  tagline: 'Crack the pattern.',
  instruction: 'Work out the rule behind the numbers and pick the missing one.',
  coopInstruction:
    'Half the sequence is on your screen, half on theirs. Read yours out loud and solve it together.',
  category: 'logic',
  accent: 'sky',
  icon: 'sequence',
  coopStyle: 'split',

  durationMs(difficulty, mode) {
    return Math.round((8000 - difficulty * 220) * (mode === 'coop' ? 1.6 : 1));
  },

  generate({ difficulty, rng, mode }) {
    const length = difficulty < 5 ? 5 : 6;
    const pool = RULES.filter((r) => r.minDifficulty <= difficulty);
    const rule = rng.pick(pool.slice(-4).length ? pool : RULES);
    const { terms, label } = rule.build(rng, length);
    // Never hide the first two terms: the rule must stay discoverable.
    const holeIndex = rng.int(2, length - 1);
    return {
      terms,
      holeIndex,
      options: buildOptions(rng, terms[holeIndex] as number, difficulty),
      ruleLabel: label,
      split: mode === 'coop',
      splitAt: Math.ceil(length / 2),
    };
  },

  viewFor(payload, slot, mode): SequenceView {
    const split = payload.split && mode === 'coop';
    const cells: SequenceCell[] = payload.terms.map((value, index) => {
      const isHole = index === payload.holeIndex;
      const mine = !split || (slot === 'A' ? index < payload.splitAt : index >= payload.splitAt);
      return {
        isHole,
        hidden: !isHole && !mine,
        value: isHole || !mine ? null : value,
      };
    });
    return { cells, options: payload.options, split };
  },

  solutionFor(payload) {
    return {
      value: payload.terms[payload.holeIndex],
      terms: payload.terms,
      rule: payload.ruleLabel,
    };
  },

  isValidAnswer(answer): answer is SequenceAnswer {
    return typeof answer === 'number' && Number.isFinite(answer);
  },

  evaluate(payload, answer) {
    const correct = answer === payload.terms[payload.holeIndex];
    return { correct, accuracy: correct ? 1 : 0 };
  },
};
