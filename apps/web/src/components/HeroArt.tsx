import { motion } from 'framer-motion';
import { MINI_GAME_LIST } from '@brain-battle/shared';
import { Icon } from '../design/Icon';
import { accentOf } from '../design/tokens';

/**
 * Hero illustration: the five live mini-games orbiting a brain core.
 * Pure SVG + motion, so it scales crisply and costs no image bytes.
 */
export function HeroArt() {
  const games = MINI_GAME_LIST;
  const radius = 108;

  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-[320px] place-items-center">
      {/* Pulse rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2 border-violet/25"
          style={{ width: 150, height: 150 }}
          animate={{ scale: [1, 2.1], opacity: [0.5, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, delay: i * 1.13, ease: 'easeOut' }}
        />
      ))}

      <motion.div
        className="absolute h-full w-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
      >
        {games.map((game, index) => {
          const angle = (index / games.length) * Math.PI * 2 - Math.PI / 2;
          const accent = accentOf(game.accent);
          return (
            <motion.div
              key={game.id}
              className="absolute left-1/2 top-1/2 grid h-14 w-14 place-items-center rounded-[20px] border-2 border-white shadow-card"
              style={{
                x: Math.cos(angle) * radius - 28,
                y: Math.sin(angle) * radius - 28,
                background: accent.soft,
                color: accent.hex,
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
            >
              <Icon name={game.icon} size={26} />
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        className="relative grid h-28 w-28 place-items-center rounded-[34px] bg-violet text-white"
        style={{ boxShadow: '0 10px 0 0 var(--color-violet-deep), 0 30px 50px -20px #5b3fd6' }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon name="brain" size={54} strokeWidth={2} />
        <motion.span
          className="absolute -right-2 -top-2 grid h-9 w-9 place-items-center rounded-full bg-sun text-ink shadow-soft"
          animate={{ scale: [1, 1.14, 1], rotate: [0, 10, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon name="bolt" size={18} />
        </motion.span>
      </motion.div>
    </div>
  );
}
