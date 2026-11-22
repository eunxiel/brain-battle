import type { MiniGameDefinition } from './types.js';

export type TileShape = 'circle' | 'squircle' | 'triangle' | 'star' | 'hexagon' | 'heart' | 'diamond';

export interface ShapeTile {
  id: number;
  shape: TileShape;
  hue: number;
  saturation: number;
  lightness: number;
  rotation: number;
  scale: number;
}

export type OddVariant = 'color' | 'shape' | 'rotation' | 'size';

export interface OddOneOutPayload {
  columns: number;
  tiles: ShapeTile[];
  oddId: number;
  variant: OddVariant;
  /** Co-op mirror: seat B receives this tile instead of tiles[oddIndex]. */
  mirrorTile: ShapeTile | null;
  mirror: boolean;
}

export interface OddOneOutView {
  columns: number;
  tiles: ShapeTile[];
  mirror: boolean;
}

export type OddOneOutAnswer = number;

const SHAPES: TileShape[] = ['circle', 'squircle', 'triangle', 'star', 'hexagon', 'heart', 'diamond'];

export const oddOneOut: MiniGameDefinition<OddOneOutPayload, OddOneOutAnswer> = {
  id: 'odd-one-out',
  title: 'Odd One Out',
  tagline: 'One of these is not like the others.',
  instruction: 'Find the single shape that breaks the pattern and tap it.',
  coopInstruction:
    'Your two boards are identical except for ONE tile. Describe your board and tap the odd tile.',
  category: 'observation',
  accent: 'coral',
  icon: 'shapes',
  coopStyle: 'mirror',

  durationMs(difficulty, mode) {
    return Math.round((6000 - difficulty * 220) * (mode === 'coop' ? 2 : 1));
  },

  generate({ difficulty, rng, mode }) {
    const mirror = mode === 'coop';
    const columns = difficulty < 4 ? 3 : difficulty < 7.5 ? 4 : 5;
    const rows = columns === 3 ? 3 : columns === 4 ? 4 : 4;
    const count = columns * rows;

    const shape = rng.pick(SHAPES);
    const hue = rng.int(0, 359);
    const saturation = rng.int(72, 92);
    const lightness = rng.int(52, 64);
    const rotation = rng.int(0, 3) * 15;
    const scale = 1;

    // Subtlety scales with difficulty.
    const hueDelta = Math.max(7, Math.round(70 - difficulty * 6));
    const rotationDelta = Math.max(8, Math.round(60 - difficulty * 5));
    const scaleDelta = Math.max(0.05, 0.3 - difficulty * 0.024);

    const variants: OddVariant[] = difficulty < 3 ? ['color', 'shape'] : ['color', 'shape', 'rotation', 'size'];
    const variant = rng.pick(variants);

    const tiles: ShapeTile[] = Array.from({ length: count }, (_, id) => ({
      id,
      shape,
      hue,
      saturation,
      lightness,
      rotation,
      scale,
    }));

    const makeOdd = (tile: ShapeTile): ShapeTile => {
      switch (variant) {
        case 'color':
          return { ...tile, hue: (hue + hueDelta * (rng.bool() ? 1 : -1) + 360) % 360 };
        case 'shape': {
          const pool = SHAPES.filter((s) => s !== shape);
          return { ...tile, shape: rng.pick(pool) };
        }
        case 'rotation':
          return { ...tile, rotation: rotation + rotationDelta };
        case 'size':
          return { ...tile, scale: scale - scaleDelta };
      }
    };

    const oddIndex = rng.int(0, count - 1);
    const oddTile = tiles[oddIndex] as ShapeTile;

    if (mirror) {
      // Both boards look uniform; the difference lives between the screens.
      return {
        columns,
        tiles,
        oddId: oddTile.id,
        variant,
        mirror: true,
        mirrorTile: makeOdd(oddTile),
      };
    }

    tiles[oddIndex] = makeOdd(oddTile);
    return { columns, tiles, oddId: oddTile.id, variant, mirror: false, mirrorTile: null };
  },

  viewFor(payload, slot, mode): OddOneOutView {
    if (payload.mirror && mode === 'coop' && slot === 'B' && payload.mirrorTile) {
      const tiles = payload.tiles.map((t) => (t.id === payload.oddId ? payload.mirrorTile! : t));
      return { columns: payload.columns, tiles, mirror: true };
    }
    return { columns: payload.columns, tiles: payload.tiles, mirror: payload.mirror };
  },

  solutionFor(payload) {
    return { oddId: payload.oddId, variant: payload.variant };
  },

  isValidAnswer(answer): answer is OddOneOutAnswer {
    return Number.isInteger(answer) && (answer as number) >= 0 && (answer as number) < 64;
  },

  evaluate(payload, answer) {
    const correct = answer === payload.oddId;
    return { correct, accuracy: correct ? 1 : 0 };
  },
};
