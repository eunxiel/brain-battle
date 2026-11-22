import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { IconButton } from './Button';

/** Soft pastel canvas with drifting colour blobs — the backdrop of every page. */
export function AppBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden app-canvas">
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-violet/18 blur-3xl animate-[float_11s_ease-in-out_infinite]" />
      <div className="absolute -right-20 top-40 h-80 w-80 rounded-full bg-coral/16 blur-3xl animate-[float_13s_ease-in-out_infinite_reverse]" />
      <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-mint/16 blur-3xl animate-[float_15s_ease-in-out_infinite]" />
      <div className="absolute right-1/4 top-1/2 h-56 w-56 rounded-full bg-sun/14 blur-3xl animate-[float_9s_ease-in-out_infinite_reverse]" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(90,63,214,.14) 1px, transparent 0)',
          backgroundSize: '26px 26px',
        }}
      />
    </div>
  );
}

export function Logo({
  size = 'md',
  withTagline = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  withTagline?: boolean;
  className?: string;
}) {
  const mark = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
  const text = size === 'lg' ? 'text-5xl' : size === 'sm' ? 'text-xl' : 'text-3xl';

  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <motion.div
        className={clsx(
          'grid place-items-center rounded-[30%] bg-violet text-white shadow-pop',
          mark,
        )}
        style={{ boxShadow: '0 8px 0 0 var(--color-violet-deep), 0 20px 40px -18px #5b3fd6' }}
        animate={{ rotate: [0, -4, 4, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon name="brain" size={size === 'lg' ? 36 : size === 'sm' ? 20 : 26} strokeWidth={2.2} />
      </motion.div>
      <div className="leading-none">
        <div className={clsx('font-display font-bold tracking-tight', text)}>
          <span className="text-ink">BRAIN</span> <span className="text-violet">BATTLE</span>
        </div>
        {withTagline && (
          <div className="mt-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-ink-faint sm:text-xs">
            Think Fast · Play Smart · Win Together
          </div>
        )}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  icon,
  dismissible = true,
  maxWidth = 'max-w-md',
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  icon?: string;
  dismissible?: boolean;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open || !dismissible || !onClose) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={clsx(
              'relative w-full rounded-[32px] border-2 border-white bg-white p-6 shadow-pop sm:p-7',
              maxWidth,
            )}
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            {dismissible && onClose && (
              <IconButton
                icon="close"
                label="Close"
                size={36}
                className="absolute right-4 top-4"
                onClick={onClose}
              />
            )}
            {(title || icon) && (
              <div className="mb-4 flex items-center gap-3 pr-10">
                {icon && (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-soft text-violet">
                    <Icon name={icon} size={24} />
                  </div>
                )}
                <div>
                  {title && (
                    <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{title}</h2>
                  )}
                  {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
                </div>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Page wrapper: consistent max width, safe-area padding and entry animation. */
export function PageShell({
  children,
  className,
  width = 'max-w-5xl',
}: {
  children: ReactNode;
  className?: string;
  width?: string;
}) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={clsx(
        'mx-auto w-full px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6',
        width,
        className,
      )}
    >
      {children}
    </motion.main>
  );
}
