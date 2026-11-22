import { useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { PARTNER_HAS_IT, type BiggerNumberView } from '@brain-battle/shared';
import { Icon } from '../design/Icon';
import { play } from '../audio/sfx';
import type { MiniGameProps } from './types';

export function BiggerNumberGame({
  view,
  submit,
  locked,
  accent,
  mode,
}: MiniGameProps<BiggerNumberView>) {
  const [picked, setPicked] = useState<number | null>(null);

  const choose = (id: number): void => {
    if (locked || picked !== null) return;
    setPicked(id);
    play('pop');
    submit(id);
  };

  const coop = mode === 'coop' && view.split;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {coop && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-3.5 py-2 text-center text-xs font-bold text-mint-deep">
          <Icon name="users" size={15} />
          Your partner holds {view.partnerCardCount} hidden cards — compare out loud!
        </div>
      )}

      <div
        className="grid w-full max-w-[min(86vw,540px)] gap-3"
        style={{ gridTemplateColumns: `repeat(${view.columns}, minmax(0, 1fr))` }}
      >
        {view.cards.map((card, index) => {
          const chosen = picked === card.id;
          return (
            <motion.button
              key={card.id}
              type="button"
              disabled={locked || picked !== null}
              onClick={() => choose(card.id)}
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.035, type: 'spring', stiffness: 320, damping: 22 }}
              whileHover={locked || picked !== null ? undefined : { y: -5 }}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[22px] border-2 p-2 shadow-card no-select',
                chosen ? 'border-transparent' : 'border-white',
              )}
              style={{
                background: chosen
                  ? accent.hex
                  : `hsl(${card.hue} 85% 96%)`,
                boxShadow: chosen ? `0 0 0 4px ${accent.soft}` : undefined,
              }}
            >
              <span
                className="font-display font-bold tabular-nums leading-none"
                style={{
                  fontSize: `clamp(1rem, ${card.scale * 2.1}rem, ${card.scale * 2.6}rem)`,
                  color: chosen ? '#fff' : `hsl(${card.hue} 70% 32%)`,
                }}
              >
                {card.display}
              </span>
            </motion.button>
          );
        })}
      </div>

      {coop && (
        <motion.button
          type="button"
          disabled={locked || picked !== null}
          onClick={() => choose(PARTNER_HAS_IT)}
          whileTap={{ scale: 0.96 }}
          className={clsx(
            'flex w-full max-w-[min(86vw,540px)] items-center justify-center gap-2 rounded-2xl border-2 px-5 py-3.5',
            'font-display text-base font-bold no-select',
            picked === PARTNER_HAS_IT
              ? 'border-transparent bg-mint text-white'
              : 'border-mint bg-white text-mint-deep hover:bg-mint-soft',
          )}
        >
          <Icon name="handshake" size={20} />
          My partner has the bigger number
        </motion.button>
      )}
    </div>
  );
}
