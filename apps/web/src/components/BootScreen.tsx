import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../design/Button';
import { Icon } from '../design/Icon';
import { Logo } from '../design/Shell';
import { useSessionStore } from '../store/session';
import { serverUrl, socket } from '../net/socket';

const TILES = ['grid', 'numbers', 'shapes', 'bar', 'sequence'];

/** No handshake should ever take this long on a local network. */
const STALL_MS = 8000;

export function BootScreen() {
  const status = useSessionStore((s) => s.status);
  const error = useSessionStore((s) => s.error);
  const [stalled, setStalled] = useState(false);

  // Last-resort escape hatch: never trap the player on a spinner.
  useEffect(() => {
    const timer = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(timer);
  }, []);

  const retry = (): void => {
    const session = useSessionStore.getState();
    session.setStatus('connecting');
    setStalled(false);
    if (socket.connected) void session.hello();
    else socket.connect();
  };

  const offline = status === 'offline' || stalled;

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
            <p className="mt-2 max-w-sm text-sm text-ink-faint">
              {error ??
                `The handshake with the game server at ${serverUrl} did not finish. Check that it is running, then reload.`}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Button icon="refresh" onClick={() => window.location.reload()}>
                Reload page
              </Button>
              <Button variant="outline" icon="link" onClick={retry}>
                Retry connection
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
