import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Icon, type IconName } from './Icon';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /**
   * Use `none` when the caller supplies its own background. Passing `bg-*`
   * alongside the default `bg-white` is a silent bug: Tailwind resolves the
   * conflict by stylesheet order, not by class order, so the override loses.
   */
  tone?: 'solid' | 'tinted' | 'none';
  children?: ReactNode;
}

export function Card({ padding = 'md', tone = 'solid', className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-card border-2 border-white shadow-card',
        tone === 'solid' && 'bg-white',
        tone === 'tinted' && 'bg-white/70 backdrop-blur-sm',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-5 sm:p-6',
        padding === 'lg' && 'p-6 sm:p-8',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Card that reacts to pointer and touch — used for every tappable tile. */
export function TapCard({
  className,
  children,
  disabled,
  ...rest
}: HTMLMotionProps<'button'> & { disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -4, scale: 1.015 }}
      whileTap={disabled ? undefined : { scale: 0.975, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className={clsx(
        'rounded-card border-2 border-white bg-white text-left shadow-card no-select',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function SectionTitle({
  icon,
  title,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('mb-3 flex items-center justify-between gap-3 px-1', className)}>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
        {icon && <Icon name={icon} size={20} className="text-violet" />}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function Pill({
  children,
  tone = 'violet',
  className,
}: {
  children: ReactNode;
  tone?: 'violet' | 'coral' | 'mint' | 'sun' | 'sky' | 'neutral';
  className?: string;
}) {
  const tones = {
    violet: 'bg-violet-soft text-violet-deep',
    coral: 'bg-coral-soft text-coral-deep',
    mint: 'bg-mint-soft text-mint-deep',
    sun: 'bg-sun-soft text-sun-deep',
    sky: 'bg-sky-soft text-sky-deep',
    neutral: 'bg-mist text-ink-soft',
  } as const;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
