import { motion } from 'framer-motion';
import { Button } from '../design/Button';
import { Icon } from '../design/Icon';
import { Logo } from '../design/Shell';
import { useSessionStore } from '../store/session';
import { socket } from '../net/socket';

const TILES = ['grid', 'numbers', 'shapes', 'bar', 'sequence'];

export function BootScreen() {
  const status = useSessionStore((s) => s.status);
  const error = useSessionStore((s) => s.error);
  const offline = status === 'offline';

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.86, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <Logo size="lg" withTagline />
        </motion.div>

        <div className="mt-10 flex items-center gap-3">
          {TILES.map((icon, index) => (
            <motion.div
              key={icon}
              className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-white bg-white text-violet shadow-card"
              animate={{ y: [0, -12, 0] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                delay: index * 0.12,
                ease: 'easeInOut',
              }}
            >
              <Icon name={icon} size={22} />
            </motion.div>
          ))}
        </div>

        <p className="mt-8 font-display text-lg font-semibold text-ink-soft">
          {offline ? 'Cannot reach the arena' : 'Warming up your brain…'}
        </p>

        {offline && (
          <>
            <p className="mt-2 max-w-xs text-sm text-ink-faint">
              {error ?? 'The game server is not responding.'} Make sure the server is running, then
              try again.
            </p>
            <Button
              className="mt-5"
              icon="refresh"
              onClick={() => {
                useSessionStore.getState().setStatus('connecting');
                socket.connect();
              }}
            >
              Retry connection
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
