import { motion } from 'framer-motion';
import { MINI_GAME_LIST } from '@brain-battle/shared';
import { Icon } from '../design/Icon';
import { accentOf } from '../design/tokens';

/**
 * Orbit radius as a share of the container, never a pixel constant: the card
 * is only ~244px wide on a 320px phone, so a fixed radius pushed the orbiting
 * tiles past the viewport and made the whole page scroll sideways.
 */
const ORBIT = 33;

/**
 * Hero illustration: the five live mini-games orbiting a brain core.
 * Pure SVG + motion, so it scales crisply and costs no image bytes.
 */
export function HeroArt() {
  const games = MINI_GAME_LIST;

  return (
    // overflow-hidden is load-bearing: the orbit below is a full-size square
    // under a continuous `rotate`, and a rotated square's *axis-aligned* box
    // grows to √2× its width. Without the clip the hero intermittently widened
    // the whole page — the overflow came and went with the rotation angle.
    <div className="relative mx-auto grid aspect-square w-full max-w-[320px] place-items-center overflow-hidden">
      {/* Pulse rings — 46% × the 2.1 end scale still fits the container. */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute aspect-square w-[46%] rounded-full border-2 border-violet/25"
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
              className="absolute grid h-12 w-12 place-items-center rounded-[18px] border-2 border-white shadow-card sm:h-14 sm:w-14 sm:rounded-[20px]"
              style={{
                left: `${50 + Math.cos(angle) * ORBIT}%`,
                top: `${50 + Math.sin(angle) * ORBIT}%`,
                x: '-50%',
                y: '-50%',
                background: accent.soft,
                color: accent.hex,
              }}
              animate={{ rotate: -360 }}
              transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
            >
              <Icon name={game.icon} size={26} className="h-[22px] w-[22px] sm:h-[26px] sm:w-[26px]" />
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        className="relative grid h-24 w-24 place-items-center rounded-[30px] bg-violet text-white sm:h-28 sm:w-28 sm:rounded-[34px]"
        style={{ boxShadow: '0 10px 0 0 var(--color-violet-deep), 0 30px 50px -20px #5b3fd6' }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon name="brain" size={54} strokeWidth={2} className="h-11 w-11 sm:h-[54px] sm:w-[54px]" />
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
