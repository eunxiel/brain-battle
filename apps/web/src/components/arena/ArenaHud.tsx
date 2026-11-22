import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameMode, MatchPlayerState, PublicPlayer } from '@brain-battle/shared';
import { Avatar } from '../../design/Avatar';
import { Hearts, TimerRing } from '../../design/Feedback';
import { Icon } from '../../design/Icon';
import { IconButton } from '../../design/Button';
import { AnimatedNumber } from '../../design/Stats';

export function ArenaHud({
  round,
  totalRounds,
  remaining,
  duration,
  onPause,
  mode,
}: {
  round: number;
  totalRounds: number;
  remaining: number;
  duration: number;
  onPause: () => void;
  mode: GameMode;
}) {
  const seconds = Math.ceil(remaining / 1000);
  return (
    <div className="flex items-center justify-between gap-3">
      <IconButton icon="pause" label="Pause menu" size={42} onClick={onPause} />

      <div className="flex flex-1 items-center justify-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-white/85 px-3.5 py-2 shadow-soft">
          <Icon name={mode === 'coop' ? 'handshake' : 'swords'} size={14} className="text-violet" />
          <span className="font-display text-sm font-bold text-ink">
            Round {round + 1}
            <span className="text-ink-faint">/{totalRounds}</span>
          </span>
        </div>
        <div className="hidden gap-1 sm:flex">
          {Array.from({ length: totalRounds }, (_, i) => (
            <span
              key={i}
              className={clsx(
                'h-1.5 w-3 rounded-full transition-colors',
                i < round ? 'bg-violet' : i === round ? 'bg-sun' : 'bg-mist-deep',
              )}
            />
          ))}
        </div>
      </div>

      <TimerRing remaining={remaining} total={duration} size={52}>
        <span
          className={clsx(
            'font-display text-base font-bold tabular-nums',
            seconds <= 3 ? 'text-coral' : 'text-ink',
          )}
        >
          {seconds}
        </span>
      </TimerRing>
    </div>
  );
}

export function PlayerStrip({
  player,
  state,
  isYou,
  answered,
  mode,
  teamScore,
}: {
  player: PublicPlayer;
  state: MatchPlayerState | undefined;
  isYou: boolean;
  answered: boolean;
  mode: GameMode;
  teamScore: number | null;
}) {
  const ring = isYou ? 'var(--color-violet)' : 'var(--color-coral)';
  const score = mode === 'coop' && teamScore !== null ? state?.score ?? 0 : state?.score ?? 0;

  return (
    <motion.div
      layout
      className={clsx(
        'relative flex items-center gap-2.5 rounded-[20px] border-2 bg-white px-3 py-2 shadow-soft',
        isYou ? 'border-violet/30' : 'border-coral/25',
        !player.connected && 'opacity-60',
      )}
    >
      <Avatar avatarId={player.avatarId} size={38} ring={ring} online={player.connected} />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1">
          <span className="max-w-[90px] truncate font-display text-[13px] font-bold text-ink sm:max-w-[140px]">
            {isYou ? 'You' : player.username}
          </span>
          {!player.connected && <Icon name="offline" size={12} className="text-coral" />}
        </div>
        <div className="font-display text-lg font-bold leading-none text-violet">
          <AnimatedNumber value={score} />
        </div>
      </div>

      <div className="ml-auto flex flex-col items-end gap-1">
        <Hearts lives={state?.lives ?? 0} size={15} />
        <AnimatePresence>
          {answered && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-[10px] font-bold text-mint-deep"
            >
              <Icon name="check" size={10} />
              LOCKED IN
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {state?.streak !== undefined && state.streak >= 2 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2.5 left-9 flex items-center gap-0.5 rounded-full bg-sun px-1.5 py-0.5 text-[10px] font-bold text-ink shadow-soft"
        >
          <Icon name="flame" size={10} />
          {state.streak}
        </motion.div>
      )}
    </motion.div>
  );
}
