import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';

export function StatTile({
  icon,
  label,
  value,
  tone = 'violet',
  className,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  tone?: 'violet' | 'coral' | 'mint' | 'sun' | 'sky';
  className?: string;
}) {
  const tones = {
    violet: 'bg-violet-soft text-violet-deep',
    coral: 'bg-coral-soft text-coral-deep',
    mint: 'bg-mint-soft text-mint-deep',
    sun: 'bg-sun-soft text-sun-deep',
    sky: 'bg-sky-soft text-sky-deep',
  } as const;

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-[22px] border-2 border-white bg-white p-3 shadow-soft',
        className,
      )}
    >
      <div className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', tones[tone])}>
        <Icon name={icon} size={20} />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="font-display text-xl font-bold text-ink">{value}</div>
        <div className="truncate text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          {label}
        </div>
      </div>
    </div>
  );
}

/** Number that rolls up when it changes — used for scores. */
export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ y: -10, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className={clsx('inline-block tabular-nums', className)}
    >
      {value.toLocaleString()}
    </motion.span>
  );
}
