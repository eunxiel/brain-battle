import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '../design/Icon';
import { useUiStore, type ToastKind } from '../store/ui';

const STYLES: Record<ToastKind, { icon: string; className: string }> = {
  info: { icon: 'sparkles', className: 'bg-violet text-white' },
  success: { icon: 'check', className: 'bg-mint text-white' },
  warning: { icon: 'clock', className: 'bg-sun text-ink' },
  error: { icon: 'close', className: 'bg-coral text-white' },
};

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = STYLES[toast.kind];
          return (
            <motion.button
              key={toast.id}
              layout
              onClick={() => dismiss(toast.id)}
              initial={{ opacity: 0, y: -24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={clsx(
                'pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3',
                'font-display text-sm font-semibold shadow-pop',
                style.className,
              )}
            >
              <Icon name={style.icon} size={18} />
              {toast.message}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
