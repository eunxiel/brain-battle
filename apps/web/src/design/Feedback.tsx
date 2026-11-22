import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { STARTING_LIVES } from '@brain-battle/shared';
import { Icon } from './Icon';

export function Hearts({
  lives,
  total = STARTING_LIVES,
  size = 22,
  className,
}: {
  lives: number;
  total?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={clsx('flex items-center gap-1', className)} aria-label={`${lives} lives left`}>
      {Array.from({ length: total }, (_, i) => {
        const alive = i < lives;
        return (
          <motion.span
            key={i}
            initial={false}
            animate={alive ? { scale: 1, opacity: 1 } : { scale: 0.82, opacity: 0.35 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          >
            <Icon
              name="heart"
              size={size}
              className={alive ? 'fill-coral text-coral' : 'fill-mist-deep text-mist-deep'}
            />
          </motion.span>
        );
      })}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 1,
  color = 'var(--color-violet)',
  height = 10,
  className,
  striped = false,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  className?: string;
  striped?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 0.0001)) * 100));
  return (
    <div
      className={clsx('w-full overflow-hidden rounded-full bg-mist-deep/70', className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
    >
      <motion.div
        className="h-full rounded-full"
        style={{
          background: striped
            ? `repeating-linear-gradient(115deg, ${color}, ${color} 10px, rgba(255,255,255,.35) 10px, rgba(255,255,255,.35) 20px)`
            : color,
        }}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 160, damping: 24 }}
      />
    </div>
  );
}

/** Circular timer used in the arena HUD. */
export function TimerRing({
  remaining,
  total,
  size = 72,
  children,
}: {
  remaining: number;
  total: number;
  size?: number;
  children?: ReactNode;
}) {
  const ratio = Math.max(0, Math.min(1, total > 0 ? remaining / total : 0));
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const urgent = ratio <= 0.25;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-mist-deep)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={urgent ? 'var(--color-coral)' : 'var(--color-violet)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 120ms linear, stroke 200ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon = 'sparkles',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-violet-soft text-violet">
        <Icon name={icon} size={30} />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-xs text-sm text-ink-soft">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-2xl bg-gradient-to-r from-mist-deep/60 via-mist-deep/30 to-mist-deep/60',
        className,
      )}
    />
  );
}

/** Full-bleed celebratory burst used on correct answers and wins. */
export function Burst({ show, color = 'var(--color-mint)' }: { show: boolean; color?: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                className="absolute h-2.5 w-2.5 rounded-full"
                style={{ background: color }}
                initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                animate={{
                  x: Math.cos(angle) * 110,
                  y: Math.sin(angle) * 110,
                  scale: 0,
                  opacity: 0,
                }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
