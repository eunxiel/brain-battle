import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  GameMode,
  PlayerRoundOutcome,
  RoundMeta,
  RoundResultPayload,
} from '@brain-battle/shared';
import { Icon } from '../../design/Icon';
import { accentOf } from '../../design/tokens';
import { play } from '../../audio/sfx';

/** 3 — 2 — 1 — GO before the first round. */
export function MatchCountdown({ remaining }: { remaining: number }) {
  const value = Math.ceil(remaining / 1000);
  const label = value <= 0 ? 'GO!' : String(value);

  useEffect(() => {
    if (value > 0 && value <= 3) play('countdown');
    if (value === 0) play('start');
  }, [value]);

  return (
    <div className="grid flex-1 place-items-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={label}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.7, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
          className="font-display text-8xl font-bold text-violet sm:text-9xl"
        >
          {label}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Shown between rounds: what the next mini-game is and how to play it. */
export function RoundIntro({
  meta,
  mode,
  remaining,
}: {
  meta: RoundMeta;
  mode: GameMode;
  remaining: number;
}) {
  const accent = accentOf(meta.accent);
  const instruction = mode === 'coop' && meta.coopInstruction ? meta.coopInstruction : meta.instruction;

  useEffect(() => {
    play('reveal');
  }, [meta.roundIndex]);

  return (
    <motion.div
      key={meta.roundIndex}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="grid flex-1 place-items-center px-2"
    >
      <div className="w-full max-w-md text-center">
        <motion.div
          className="mx-auto grid h-24 w-24 place-items-center rounded-[30px] text-white"
          style={{ background: accent.hex, boxShadow: `0 10px 0 0 ${accent.deep}` }}
          animate={{ rotate: [0, -6, 6, 0], y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon name={meta.icon} size={46} strokeWidth={2} />
        </motion.div>

        <div
          className="mx-auto mt-5 w-fit rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ background: accent.soft, color: accent.deep }}
        >
          {meta.category} · difficulty {Math.round(meta.difficulty)}/10
        </div>

        <h2 className="mt-3 font-display text-4xl font-bold text-ink">{meta.title}</h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] font-medium leading-relaxed text-ink-soft">
          {instruction}
        </p>

        <div className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 shadow-card">
          <Icon name="clock" size={16} className="text-violet" />
          <span className="font-display text-sm font-bold text-ink">
            Starting in {Math.max(1, Math.ceil(remaining / 1000))}…
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/** Post-round verdict with points, streak and the partner/opponent result. */
export function RoundResult({
  result,
  myId,
  mode,
  opponentName,
}: {
  result: RoundResultPayload;
  myId: string;
  mode: GameMode;
  opponentName: string | null;
}) {
  const mine = result.outcomes.find((o) => o.playerId === myId);
  const theirs = result.outcomes.find((o) => o.playerId !== myId) ?? null;
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    if (played) return;
    setPlayed(true);
    play(mine?.correct ? 'correct' : 'wrong');
  }, [mine?.correct, played]);

  const tone = mine?.correct ? 'mint' : 'coral';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="pointer-events-none absolute inset-0 z-30 grid place-items-center p-4"
    >
      <div className="w-full max-w-xs rounded-[30px] border-2 border-white bg-white/95 p-6 text-center shadow-pop backdrop-blur">
        <motion.div
          initial={{ scale: 0.3, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 14 }}
          className={clsx(
            'mx-auto grid h-20 w-20 place-items-center rounded-full text-white',
            tone === 'mint' ? 'bg-mint' : 'bg-coral',
          )}
        >
          <Icon name={mine?.correct ? 'check' : 'close'} size={42} />
        </motion.div>

        <h3 className="mt-4 font-display text-2xl font-bold text-ink">
          {mine?.correct ? 'Nailed it!' : mine?.answered ? 'Not quite…' : 'Too slow!'}
        </h3>

        {mine && mine.points > 0 && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="mt-1 font-display text-3xl font-bold text-violet"
          >
            +{mine.points}
          </motion.div>
        )}

        {mine && mine.livesLost > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-coral-soft px-3 py-1 text-xs font-bold text-coral-deep">
            <Icon name="heart" size={13} />
            {mode === 'coop' ? 'Team lost a life' : 'Lost a life'}
          </div>
        )}

        {result.syncBonus > 0 && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-bold text-white"
          >
            <Icon name="sparkles" size={13} />
            SYNC BONUS +{result.syncBonus}
          </motion.div>
        )}

        {theirs && opponentName && (
          <div className="mt-4 border-t-2 border-mist pt-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              {mode === 'coop' ? 'Partner' : 'Opponent'}
            </div>
            <div className="mt-1 flex items-center justify-center gap-2 font-display text-sm font-bold text-ink">
              <span
                className={clsx(
                  'grid h-6 w-6 place-items-center rounded-full text-white',
                  theirs.correct ? 'bg-mint' : 'bg-coral',
                )}
              >
                <Icon name={theirs.correct ? 'check' : 'close'} size={13} />
              </span>
              {opponentName} {theirs.correct ? `+${theirs.points}` : 'missed'}
            </div>
          </div>
        )}

        <SolutionHint outcome={mine} solution={result.solution} />
      </div>
    </motion.div>
  );
}

function SolutionHint({
  outcome,
  solution,
}: {
  outcome: PlayerRoundOutcome | undefined;
  solution: unknown;
}) {
  if (outcome?.correct) return null;
  const text = describeSolution(solution);
  if (!text) return null;
  return (
    <div className="mt-3 rounded-2xl bg-mist px-3 py-2 text-xs font-semibold text-ink-soft">
      {text}
    </div>
  );
}

/** Turns a mini-game solution object into one friendly line. */
function describeSolution(solution: unknown): string | null {
  if (solution === null || solution === undefined) return null;
  if (Array.isArray(solution)) return `Order was ${solution.map((n) => Number(n) + 1).join(' → ')}`;
  if (typeof solution === 'object') {
    const value = solution as Record<string, unknown>;
    if (typeof value.display === 'string') return `The biggest was ${value.display}`;
    if (typeof value.value === 'number' && typeof value.rule === 'string') {
      return `Answer: ${value.value} (${value.rule})`;
    }
    if (typeof value.center === 'number') {
      return `The zone was at ${Math.round(value.center * 100)}% of the bar`;
    }
    if (typeof value.variant === 'string') return `The odd one differed by ${value.variant}`;
  }
  return null;
}
