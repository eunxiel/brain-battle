import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { MemoryGridView } from '@brain-battle/shared';
import { Button } from '../design/Button';
import { Icon } from '../design/Icon';
import { play } from '../audio/sfx';
import type { MiniGameProps } from './types';

type Phase = 'watch' | 'input';

export function MemoryGridGame({ view, submit, locked, accent, mode }: MiniGameProps<MemoryGridView>) {
  const [phase, setPhase] = useState<Phase>('watch');
  const [litIndex, setLitIndex] = useState<number | null>(null);
  const [entered, setEntered] = useState<number[]>([]);
  const timers = useRef<number[]>([]);

  const cells = view.size * view.size;
  const gapClass = view.size >= 5 ? 'gap-1.5' : 'gap-2.5';

  // Replay the sequence the server allowed this seat to watch.
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase('watch');
    setEntered([]);
    setLitIndex(null);

    const step = view.flashMs + view.gapMs;
    view.visibleSteps.forEach((tile, index) => {
      timers.current.push(
        window.setTimeout(() => {
          setLitIndex(tile);
          play('reveal');
        }, 450 + index * step),
      );
      timers.current.push(
        window.setTimeout(() => setLitIndex(null), 450 + index * step + view.flashMs),
      );
    });
    timers.current.push(
      window.setTimeout(
        () => setPhase('input'),
        450 + view.visibleSteps.length * step + 120,
      ),
    );

    return () => timers.current.forEach(clearTimeout);
  }, [view]);

  const pick = (tile: number): void => {
    if (phase !== 'input' || locked) return;
    const next = [...entered, tile];
    setEntered(next);
    play('click');
    if (next.length >= view.totalSteps) {
      play('pop');
      submit(next);
    }
  };

  const progressDots = useMemo(
    () => Array.from({ length: view.totalSteps }, (_, i) => i < entered.length),
    [entered.length, view.totalSteps],
  );

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Status line */}
      <div className="flex min-h-7 items-center gap-2">
        {phase === 'watch' ? (
          <motion.span
            className="font-display text-base font-bold"
            style={{ color: accent.hex }}
            animate={{ opacity: [1, 0.45, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          >
            {mode === 'coop' ? 'Watch YOUR half…' : 'Watch carefully…'}
          </motion.span>
        ) : (
          <span className="font-display text-base font-bold text-ink">
            Tap all {view.totalSteps} tiles in order
          </span>
        )}
      </div>

      {mode === 'coop' && view.split && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-3.5 py-2 text-center text-xs font-bold text-mint-deep">
          <Icon name="users" size={15} />
          You saw steps {view.stepOffset}–{view.stepOffset + view.visibleSteps.length - 1} of{' '}
          {view.totalSteps}. Share them out loud!
        </div>
      )}

      {/* Grid */}
      <div
        className={clsx('grid w-full max-w-[min(78vw,420px)]', gapClass)}
        style={{ gridTemplateColumns: `repeat(${view.size}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cells }, (_, tile) => {
          const lit = litIndex === tile;
          const chosenCount = entered.filter((t) => t === tile).length;
          return (
            <motion.button
              key={tile}
              type="button"
              disabled={phase !== 'input' || locked}
              onClick={() => pick(tile)}
              animate={
                lit
                  ? { scale: 1.08, backgroundColor: accent.hex }
                  : { scale: 1, backgroundColor: '#ffffff' }
              }
              whileTap={phase === 'input' && !locked ? { scale: 0.93 } : undefined}
              transition={{ duration: 0.12 }}
              className={clsx(
                'relative aspect-square rounded-[18px] border-2 shadow-soft no-select',
                lit ? 'border-white' : 'border-mist-deep/70',
                phase === 'input' && !locked ? 'cursor-pointer hover:border-violet' : '',
              )}
              style={{ boxShadow: lit ? `0 0 0 4px ${accent.soft}` : undefined }}
              aria-label={`Tile ${tile + 1}`}
            >
              {chosenCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 grid place-items-center font-display text-sm font-bold"
                  style={{ color: accent.hex }}
                >
                  {entered.map((t, i) => (t === tile ? i + 1 : null)).filter(Boolean).join(',')}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Entered progress */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {progressDots.map((filled, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full transition-colors"
              style={{ background: filled ? accent.hex : 'var(--color-mist-deep)' }}
            />
          ))}
        </div>
        {phase === 'input' && entered.length > 0 && !locked && (
          <Button
            size="sm"
            variant="outline"
            icon="refresh"
            onClick={() => {
              play('click');
              setEntered([]);
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
