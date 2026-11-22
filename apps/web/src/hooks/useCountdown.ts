import { useEffect, useRef, useState } from 'react';
import { serverClock } from '../net/socket';

/**
 * Counts down to an absolute *server* timestamp, animated with rAF so the ring
 * stays smooth without re-rendering at 60fps unnecessarily.
 */
export function useCountdown(deadline: number | null, fps = 20): number {
  const [remaining, setRemaining] = useState(() =>
    deadline ? Math.max(0, serverClock.until(deadline)) : 0,
  );
  const frame = useRef<number>(0);
  const last = useRef(0);

  useEffect(() => {
    if (!deadline) {
      setRemaining(0);
      return;
    }
    const interval = 1000 / fps;
    const tick = (time: number): void => {
      if (time - last.current >= interval) {
        last.current = time;
        setRemaining(Math.max(0, serverClock.until(deadline)));
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [deadline, fps]);

  return remaining;
}

/** Elapsed milliseconds since an absolute server timestamp. */
export function useElapsed(startedAt: number | null, fps = 30): number {
  const [elapsed, setElapsed] = useState(0);
  const frame = useRef<number>(0);
  const last = useRef(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const interval = 1000 / fps;
    const tick = (time: number): void => {
      if (time - last.current >= interval) {
        last.current = time;
        setElapsed(Math.max(0, serverClock.now() - startedAt));
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [startedAt, fps]);

  return elapsed;
}
