/**
 * Deterministic seeded RNG (mulberry32).
 * The server generates every puzzle from a seed so a round can be replayed,
 * audited or regenerated identically on any machine.
 */
export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** float in [min, max) */
  float(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  bool(chance?: number): boolean;
}

export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number =>
    Math.floor(next() * (max - min + 1)) + min;

  return {
    next,
    int,
    float: (min, max) => next() * (max - min) + min,
    pick: <T,>(items: readonly T[]): T => items[int(0, items.length - 1)] as T,
    shuffle: <T,>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
      }
      return copy;
    },
    bool: (chance = 0.5) => next() < chance,
  };
}
