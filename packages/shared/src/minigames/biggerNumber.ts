import type { PlayerSlot } from '../types.js';
import type { MiniGameDefinition } from './types.js';

export interface NumberCard {
  id: number;
  value: number;
  /** What is printed on the card — may be an expression at high difficulty. */
  display: string;
  /** 0.7 .. 1.4 — deliberately uncorrelated with value to defeat eyeballing. */
  scale: number;
  hue: number;
  owner: PlayerSlot | null;
}

export interface BiggerNumberPayload {
  cards: NumberCard[];
  columns: number;
  /** Co-op: cards are dealt between the two seats. */
  split: boolean;
}

export interface BiggerNumberView {
  cards: Omit<NumberCard, 'value' | 'owner'>[];
  columns: number;
  split: boolean;
  /** Co-op: number of cards the partner is holding. */
  partnerCardCount: number;
}

/** A card id, or PARTNER_HAS_IT when the team maximum sits on the other screen. */
export const PARTNER_HAS_IT = -1;
export type BiggerNumberAnswer = number;

function cardCount(difficulty: number): number {
  return Math.min(9, Math.round(4 + difficulty * 0.5));
}

export const biggerNumber: MiniGameDefinition<BiggerNumberPayload, BiggerNumberAnswer> = {
  id: 'bigger-number',
  title: 'Bigger Number',
  tagline: 'Spot the biggest value.',
  instruction: 'Tap the card holding the biggest value. Card size means nothing — read carefully.',
  coopInstruction:
    'You each hold half the cards. Shout your highest, then tap it — or tap PARTNER if theirs wins.',
  category: 'math',
  accent: 'sun',
  icon: 'numbers',
  coopStyle: 'split',

  durationMs(difficulty, mode) {
    return Math.round((5200 - difficulty * 180) * (mode === 'coop' ? 1.7 : 1));
  },

  generate({ difficulty, rng, mode }) {
    const count = cardCount(difficulty);
    const split = mode === 'coop';
    // High difficulty packs values tightly and hides them inside expressions.
    const magnitude = Math.pow(10, 1 + Math.floor(difficulty / 3));
    const spread = Math.max(2, Math.round(magnitude * (1.05 - difficulty * 0.09)));
    const base = rng.int(magnitude, magnitude * 4);

    const values = new Set<number>();
    while (values.size < count) values.add(base + rng.int(0, spread));
    const list = [...values];
    const max = Math.max(...list);

    const cards: NumberCard[] = rng.shuffle(list).map((value, index) => {
      const useExpression = difficulty >= 6 && value !== max ? rng.bool(0.35) : rng.bool(0.15);
      let display = String(value);
      if (difficulty >= 4 && useExpression) {
        const part = rng.int(Math.floor(value * 0.2), Math.floor(value * 0.45));
        display = `${value - part} + ${part}`;
      } else if (difficulty >= 7 && rng.bool(0.2)) {
        display = (value / 100).toFixed(2);
      }
      return {
        id: index,
        value,
        display,
        scale: Math.round(rng.float(0.72, 1.4) * 100) / 100,
        hue: rng.int(0, 359),
        owner: split ? ((index % 2 === 0 ? 'A' : 'B') as PlayerSlot) : null,
      };
    });

    // Decimal display must not change the compared value — re-sync it.
    for (const card of cards) {
      if (card.display.includes('.')) card.display = `${card.value / 100}`.slice(0, 8);
    }

    return { cards, columns: count <= 4 ? 2 : 3, split };
  },

  viewFor(payload, slot, mode): BiggerNumberView {
    const mine =
      mode === 'coop' && payload.split
        ? payload.cards.filter((c) => c.owner === slot)
        : payload.cards;
    return {
      columns: payload.columns,
      split: payload.split && mode === 'coop',
      partnerCardCount: payload.cards.length - mine.length,
      cards: mine.map(({ id, display, scale, hue }) => ({ id, display, scale, hue })),
    };
  },

  solutionFor(payload) {
    const best = payload.cards.reduce((a, b) => (b.value > a.value ? b : a));
    return { id: best.id, value: best.value, display: best.display, owner: best.owner };
  },

  isValidAnswer(answer): answer is BiggerNumberAnswer {
    return Number.isInteger(answer) && (answer as number) >= PARTNER_HAS_IT;
  },

  evaluate(payload, answer, slot, mode) {
    const best = payload.cards.reduce((a, b) => (b.value > a.value ? b : a));
    if (mode === 'coop' && payload.split) {
      const bestIsMine = best.owner === slot;
      const correct = bestIsMine ? answer === best.id : answer === PARTNER_HAS_IT;
      return { correct, accuracy: correct ? 1 : 0 };
    }
    return { correct: answer === best.id, accuracy: answer === best.id ? 1 : 0 };
  },
};
