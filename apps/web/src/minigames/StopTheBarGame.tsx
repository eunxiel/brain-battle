import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { barPositionAt, type StopTheBarView } from '@brain-battle/shared';
import { Icon } from '../design/Icon';
import { play } from '../audio/sfx';
import type { MiniGameProps } from './types';

export function StopTheBarGame({
  view,
  submit,
  elapsed,
  locked,
  accent,
}: MiniGameProps<StopTheBarView>) {
  const [position, setPosition] = useState(() => barPositionAt(view, 0));
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const frame = useRef(0);
  // Elapsed is sampled from the shared clock; the marker interpolates locally
  // between samples so the motion stays perfectly smooth.
  const elapsedRef = useRef(elapsed);
  const sampledAt = useRef(performance.now());

  useEffect(() => {
    elapsedRef.current = elapsed;
    sampledAt.current = performance.now();
  }, [elapsed]);

  useEffect(() => {
    if (stoppedAt !== null || locked) return;
    const tick = (): void => {
      const localElapsed = elapsedRef.current + (performance.now() - sampledAt.current);
      setPosition(barPositionAt(view, localElapsed));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [view, stoppedAt, locked]);

  const stop = (): void => {
    if (locked || stoppedAt !== null) return;
    const at = elapsedRef.current + (performance.now() - sampledAt.current);
    setStoppedAt(at);
    setPosition(barPositionAt(view, at));
    play('pop');
    // The server replays the motion from this timestamp, so it is the answer.
    submit({ elapsedMs: Math.round(at) }, Math.round(at));
  };

  // Space bar works on desktop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const zone = view.ownZone;
  const partner = view.partnerZone;

  return (
    <div className="flex w-full max-w-[min(90vw,560px)] flex-col items-center gap-5">
      {view.blindfolded && (
        <div className="flex items-center gap-2 rounded-2xl bg-mint-soft px-3.5 py-2 text-center text-xs font-bold text-mint-deep">
          <Icon name="users" size={15} />
          Your target is hidden — your partner can see it. Guide each other!
        </div>
      )}

      {/* Partner's track (co-op): read-only view of where THEY must stop */}
      {partner && (
        <div className="w-full">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            <Icon name="handshake" size={13} />
            Your partner&rsquo;s target — call it out
          </div>
          <Track zonePercent={partner.center * 100} widthPercent={partner.width * 100} muted />
        </div>
      )}

      {/* Your track */}
      <div className="w-full">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          <span>Your bar</span>
          {!zone && <span className="text-mint-deep">Target hidden</span>}
        </div>
        <Track
          zonePercent={zone ? zone.center * 100 : null}
          widthPercent={zone ? zone.width * 100 : null}
          marker={position * 100}
          accent={accent.hex}
          stopped={stoppedAt !== null}
        />
      </div>

      <motion.button
        type="button"
        onClick={stop}
        disabled={locked || stoppedAt !== null}
        whileTap={{ scale: 0.94 }}
        className={clsx(
          'grid h-24 w-24 place-items-center rounded-full font-display text-xl font-bold text-white no-select',
          'transition-colors disabled:opacity-60 sm:h-28 sm:w-28 sm:text-2xl',
        )}
        style={{
          background: stoppedAt !== null ? 'var(--color-ink-faint)' : accent.hex,
          boxShadow:
            stoppedAt !== null
              ? 'none'
              : `0 8px 0 0 ${accent.deep}, 0 22px 36px -18px ${accent.deep}`,
        }}
      >
        {stoppedAt !== null ? 'SENT' : 'STOP'}
      </motion.button>

      <p className="text-xs font-semibold text-ink-faint">Tap STOP or press Space</p>
    </div>
  );
}

function Track({
  zonePercent,
  widthPercent,
  marker,
  accent = 'var(--color-violet)',
  muted = false,
  stopped = false,
}: {
  zonePercent: number | null;
  widthPercent: number | null;
  marker?: number;
  accent?: string;
  muted?: boolean;
  stopped?: boolean;
}) {
  return (
    <div
      className={clsx(
        'relative h-16 w-full overflow-hidden rounded-[22px] border-2 border-white shadow-soft',
        muted ? 'bg-mist' : 'bg-mist-deep/50',
      )}
    >
      {/* Target zone */}
      {zonePercent !== null && widthPercent !== null && (
        <>
          <div
            className="absolute inset-y-0 rounded-xl"
            style={{
              left: `${zonePercent - widthPercent / 2}%`,
              width: `${widthPercent}%`,
              background: muted
                ? 'repeating-linear-gradient(135deg, var(--color-mint-200), var(--color-mint-200) 8px, var(--color-mint-soft) 8px, var(--color-mint-soft) 16px)'
                : 'var(--color-mint)',
              opacity: muted ? 1 : 0.9,
            }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-white/80"
            style={{ left: `${zonePercent}%` }}
          />
        </>
      )}

      {/* Hidden-zone hatching for the blindfolded player */}
      {zonePercent === null && !muted && (
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, rgba(255,255,255,.7) 0 10px, transparent 10px 20px)',
          }}
        />
      )}

      {/* Marker */}
      {marker !== undefined && (
        <div
          className="absolute inset-y-1.5 w-2.5 rounded-full"
          style={{
            left: `calc(${marker}% - 5px)`,
            background: stopped ? 'var(--color-ink)' : accent,
            boxShadow: `0 0 0 4px ${stopped ? 'rgba(35,26,77,.18)' : 'rgba(255,255,255,.75)'}`,
          }}
        />
      )}
    </div>
  );
}
