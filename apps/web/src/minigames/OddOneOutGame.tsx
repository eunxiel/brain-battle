import { useState, type ReactElement } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { OddOneOutView, ShapeTile, TileShape } from '@brain-battle/shared';
import { Icon } from '../design/Icon';
import { play } from '../audio/sfx';
import type { MiniGameProps } from './types';

/** Shape geometry on a 100x100 canvas. */
function ShapeGlyph({ tile }: { tile: ShapeTile }) {
  const fill = `hsl(${tile.hue} ${tile.saturation}% ${tile.lightness}%)`;
  const common = { fill, transform: `rotate(${tile.rotation} 50 50) scale(${tile.scale})` };
  const transformOrigin = { transformOrigin: '50px 50px' };

  const paths: Record<TileShape, ReactElement> = {
    circle: <circle cx="50" cy="50" r="34" {...common} style={transformOrigin} />,
    squircle: <rect x="16" y="16" width="68" height="68" rx="22" {...common} style={transformOrigin} />,
    triangle: <path d="M50 14 86 82H14Z" {...common} style={transformOrigin} />,
    star: (
      <path
        d="M50 12l10.6 23.4L86 38.6 67.5 56.2 72.3 82 50 69.4 27.7 82l4.8-25.8L14 38.6l25.4-3.2z"
        {...common}
        style={transformOrigin}
      />
    ),
    hexagon: <path d="M50 12l33 19v38L50 88 17 69V31z" {...common} style={transformOrigin} />,
    heart: (
      <path
        d="M50 84S16 62 16 40a18 18 0 0 1 34-8 18 18 0 0 1 34 8c0 22-34 44-34 44z"
        {...common}
        style={transformOrigin}
      />
    ),
    diamond: <path d="M50 12 84 50 50 88 16 50z" {...common} style={transformOrigin} />,
  };

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {paths[tile.shape]}
    </svg>
  );
}

export function OddOneOutGame({ view, submit, locked, accent, mode }: MiniGameProps<OddOneOutView>) {
  const [picked, setPicked] = useState<number | null>(null);

  const choose = (id: number): void => {
    if (locked || picked !== null) return;
    setPicked(id);
    play('pop');
    submit(id);
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {mode === 'coop' && view.mirror && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-3.5 py-2 text-center text-xs font-bold text-mint-deep">
          <Icon name="users" size={15} />
          One tile differs between your two screens — describe yours to find it.
        </div>
      )}

      <div
        className="grid w-full max-w-[min(82vw,460px)] gap-2.5"
        style={{ gridTemplateColumns: `repeat(${view.columns}, minmax(0, 1fr))` }}
      >
        {view.tiles.map((tile, index) => {
          const chosen = picked === tile.id;
          return (
            <motion.button
              key={tile.id}
              type="button"
              disabled={locked || picked !== null}
              onClick={() => choose(tile.id)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.016, type: 'spring', stiffness: 360, damping: 24 }}
              whileHover={locked || picked !== null ? undefined : { scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className={clsx(
                'aspect-square rounded-[18px] border-2 bg-white p-1.5 shadow-soft no-select',
                chosen ? 'border-transparent' : 'border-white',
              )}
              style={{ boxShadow: chosen ? `0 0 0 4px ${accent.hex}` : undefined }}
              aria-label={`Shape ${index + 1}`}
            >
              <ShapeGlyph tile={tile} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
