import { useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { SequenceView } from '@brain-battle/shared';
import { Icon } from '../design/Icon';
import { play } from '../audio/sfx';
import type { MiniGameProps } from './types';

export function SequenceGame({ view, submit, locked, accent, mode }: MiniGameProps<SequenceView>) {
  const [picked, setPicked] = useState<number | null>(null);

  const choose = (value: number): void => {
    if (locked || picked !== null) return;
    setPicked(value);
    play('pop');
    submit(value);
  };

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {mode === 'coop' && view.split && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-3.5 py-2 text-center text-xs font-bold text-mint-deep">
          <Icon name="users" size={15} />
          Greyed cells live on your partner&rsquo;s screen — read yours out loud.
        </div>
      )}

      {/* The sequence */}
      <div className="flex w-full max-w-[min(92vw,620px)] flex-wrap items-center justify-center gap-2 sm:gap-3">
        {view.cells.map((cell, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={clsx(
              'grid h-14 min-w-14 place-items-center rounded-[18px] border-2 px-2.5 font-display text-xl font-bold shadow-soft sm:h-20 sm:min-w-20 sm:rounded-[20px] sm:px-3 sm:text-3xl',
              cell.isHole
                ? 'border-dashed bg-white'
                : cell.hidden
                  ? 'border-mist-deep bg-mist text-ink-faint'
                  : 'border-white bg-white text-ink',
            )}
            style={
              cell.isHole
                ? { borderColor: accent.hex, color: accent.hex, background: accent.soft }
                : undefined
            }
          >
            {cell.isHole ? (
              picked !== null ? (
                <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                  {picked}
                </motion.span>
              ) : (
                '?'
              )
            ) : cell.hidden ? (
              <Icon name="users" size={22} />
            ) : (
              cell.value
            )}
          </motion.div>
        ))}
      </div>

      {/* Options */}
      <div className="grid w-full max-w-[min(90vw,460px)] grid-cols-2 gap-3">
        {view.options.map((option, index) => {
          const chosen = picked === option;
          return (
            <motion.button
              key={option}
              type="button"
              disabled={locked || picked !== null}
              onClick={() => choose(option)}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              whileHover={locked || picked !== null ? undefined : { y: -4 }}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'h-16 rounded-[20px] border-2 font-display text-2xl font-bold shadow-card no-select',
                chosen ? 'border-transparent text-white' : 'border-white bg-white text-ink',
              )}
              style={chosen ? { background: accent.hex } : undefined}
            >
              {option}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
