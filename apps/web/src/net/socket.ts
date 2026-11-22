import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@brain-battle/shared';

const DEV_SERVER_PORT = 4000;

/** Loopback, mDNS and RFC1918 — the hosts where `npm run dev` can be reached. */
function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * Guessing `<page host>:4000` is correct for `npm run dev` and LAN play, and
 * nonsense anywhere else: a deployed build dialled a port its own host does not
 * serve, so the socket sat in SYN_SENT until the boot screen gave up — looking
 * like a broken game rather than a missing backend. Off a local host the URL
 * must be configured, and when it is not we say exactly that.
 */
function resolveServer(): { url: string; error: string | null } {
  const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
  if (configured) return { url: configured.replace(/\/+$/, ''), error: null };

  const { protocol, hostname } = window.location;
  const guess = `${protocol}//${hostname}:${DEV_SERVER_PORT}`;
  if (isLocalHost(hostname)) return { url: guess, error: null };

  return {
    url: guess,
    error:
      `This build has no VITE_SERVER_URL, so it has no game server to talk to. ` +
      `The page is served from ${hostname}, which hosts the interface only — ` +
      `the match engine runs as a separate service.`,
  };
}

const resolved = resolveServer();

export type BBSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: BBSocket = io(resolved.url, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 600,
  reconnectionDelayMax: 4000,
});

/** Promise wrapper around Socket.IO acknowledgement callbacks. */
export function request<T>(event: keyof ClientToServerEvents, payload?: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const timeout = setTimeout(
      () => resolve({ ok: false, code: 'SERVER_ERROR', message: 'The server did not respond.' }),
      10_000,
    );
    const done = (res: Ack<T>): void => {
      clearTimeout(timeout);
      resolve(res ?? { ok: false, code: 'SERVER_ERROR', message: 'Empty response.' });
    };
    // Re-type the socket itself rather than pulling `emit` off it: a detached
    // emit loses its `this` and blows up inside Socket.IO.
    const loose = socket as unknown as {
      emit: (event: string, ...args: unknown[]) => void;
    };
    if (payload === undefined) loose.emit(event, done);
    else loose.emit(event, payload, done);
  });
}

/**
 * Round deadlines are absolute server timestamps, so the client keeps a rolling
 * estimate of the offset between the two clocks.
 */
class ServerClock {
  private offset = 0;
  private samples: number[] = [];

  now(): number {
    return Date.now() + this.offset;
  }

  /** Converts a server timestamp into milliseconds from now. */
  until(serverTimestamp: number): number {
    return serverTimestamp - this.now();
  }

  async sync(rounds = 3): Promise<void> {
    for (let i = 0; i < rounds; i++) {
      const sentAt = Date.now();
      const serverNow = await new Promise<number>((resolve) => {
        const timeout = setTimeout(() => resolve(0), 4000);
        socket.emit('time:ping', (value: number) => {
          clearTimeout(timeout);
          resolve(value);
        });
      });
      if (!serverNow) continue;
      const rtt = Date.now() - sentAt;
      this.samples.push(serverNow + rtt / 2 - Date.now());
      if (this.samples.length > 5) this.samples.shift();
      // Median is robust against a single slow round trip.
      const sorted = [...this.samples].sort((a, b) => a - b);
      this.offset = sorted[Math.floor(sorted.length / 2)] ?? 0;
    }
  }
}

export const serverClock = new ServerClock();
export const serverUrl = resolved.url;
/** Non-null when the build cannot know where its server is. */
export const serverUrlError = resolved.error;
