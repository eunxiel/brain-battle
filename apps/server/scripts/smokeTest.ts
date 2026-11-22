/**
 * Headless two-client integration test.
 *   npm run smoke --workspace @brain-battle/server
 *
 * Drives a full Versus match and a full Co-op match over real Socket.IO
 * connections using only the information the server actually sends a client —
 * which doubles as a check that no solution ever leaks into a round payload.
 */
import { io, type Socket } from 'socket.io-client';
import {
  PARTNER_HAS_IT,
  TOTAL_ROUNDS,
  barPositionAt,
  type Ack,
  type BiggerNumberView,
  type GameMode,
  type MatchResult,
  type MemoryGridView,
  type MiniGameId,
  type OddOneOutView,
  type RoundResultPayload,
  type RoundStartPayload,
  type SequenceView,
  type StopTheBarView,
} from '@brain-battle/shared';

const URL = process.env.SMOKE_URL ?? 'http://localhost:4000';

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label} ${detail}`);
  }
}

function emitAck<T>(socket: Socket, event: string, payload?: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (payload === undefined) socket.emit(event, resolve);
    else socket.emit(event, payload, resolve);
  });
}

interface Bot {
  name: string;
  socket: Socket;
  playerId: string;
  currentGame: MiniGameId | null;
  leaked: string[];
  rounds: number;
}

/** Plays each mini-game from the client-visible payload only. */
function solve(gameId: MiniGameId, view: unknown, startedAt: number): unknown {
  switch (gameId) {
    case 'memory-grid': {
      const v = view as MemoryGridView;
      // Only knows its own half in co-op, so it can only be fully right in versus.
      const guess = [...v.visibleSteps];
      while (guess.length < v.totalSteps) guess.push(0);
      return guess.slice(0, v.totalSteps);
    }
    case 'bigger-number': {
      const v = view as BiggerNumberView;
      let best = v.cards[0];
      let bestValue = -Infinity;
      for (const card of v.cards) {
        const value = card.display.includes('+')
          ? card.display.split('+').reduce((sum, part) => sum + Number(part.trim()), 0)
          : Number(card.display);
        if (value > bestValue) {
          bestValue = value;
          best = card;
        }
      }
      // In co-op the bot cannot see the partner's hand, so it bets on its own
      // best card — exactly the mistake the mode is designed to punish.
      return best?.id ?? PARTNER_HAS_IT;
    }
    case 'odd-one-out': {
      const v = view as OddOneOutView;
      const signature = (t: OddOneOutView['tiles'][number]): string =>
        `${t.shape}|${t.hue}|${t.rotation}|${t.scale}`;
      const counts = new Map<string, number>();
      for (const tile of v.tiles) counts.set(signature(tile), (counts.get(signature(tile)) ?? 0) + 1);
      const odd = v.tiles.find((t) => counts.get(signature(t)) === 1);
      return odd?.id ?? v.tiles[0]?.id ?? 0;
    }
    case 'stop-the-bar': {
      const v = view as StopTheBarView;
      if (!v.ownZone) return { elapsedMs: Date.now() - startedAt };
      // Solve for the first time the marker crosses the zone centre.
      const step = 10;
      for (let t = 0; t < 20_000; t += step) {
        if (Math.abs(barPositionAt(v, t) - v.ownZone.center) < 0.01) return { elapsedMs: t };
      }
      return { elapsedMs: Date.now() - startedAt };
    }
    case 'sequence': {
      const v = view as SequenceView;
      return v.options[Math.floor(Math.random() * v.options.length)] ?? 0;
    }
    default:
      return null;
  }
}

/** Fails loudly if a round payload contains anything that resembles the answer. */
function detectLeak(gameId: MiniGameId, view: unknown): string | null {
  const json = JSON.stringify(view) ?? '';
  const banned: Record<MiniGameId, string[]> = {
    'memory-grid': [],
    'bigger-number': ['"value"', '"owner"'],
    'odd-one-out': ['oddId', 'variant', 'mirrorTile'],
    'stop-the-bar': ['zones'],
    sequence: ['terms', 'holeIndex', 'ruleLabel'],
  };
  const hit = banned[gameId].find((key) => json.includes(key));
  return hit ? `${gameId} payload exposed ${hit}` : null;
}

async function createBot(name: string): Promise<Bot> {
  const socket = io(URL, { transports: ['websocket'] });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  const hello = await emitAck<{ profile: { id: string } }>(socket, 'session:hello', {
    playerId: null,
    username: name,
  });
  if (!hello.ok) throw new Error(`hello failed for ${name}`);

  const bot: Bot = {
    name,
    socket,
    playerId: hello.data.profile.id,
    currentGame: null,
    leaked: [],
    rounds: 0,
  };

  socket.on('round:intro', (meta: { gameId: MiniGameId }) => {
    bot.currentGame = meta.gameId;
  });
  socket.on('round:start', (payload: RoundStartPayload) => {
    const gameId = bot.currentGame;
    if (!gameId) return;
    bot.rounds++;
    const leak = detectLeak(gameId, payload.payload);
    if (leak) bot.leaked.push(leak);

    const answer = solve(gameId, payload.payload, Date.now());
    const think =
      gameId === 'memory-grid'
        ? Math.min(payload.durationMs - 400, 1200)
        : gameId === 'stop-the-bar'
          ? (answer as { elapsedMs: number }).elapsedMs
          : 300 + Math.random() * 400;
    setTimeout(
      () =>
        socket.emit(
          'match:answer',
          { roundIndex: payload.roundIndex, answer, elapsedMs: Math.round(think) },
          () => undefined,
        ),
      Math.max(0, think),
    );
  });

  return bot;
}

async function playMatch(mode: GameMode): Promise<void> {
  console.log(`\n--- ${mode.toUpperCase()} match ---`);
  const host = await createBot(`Host_${mode}`);
  const guest = await createBot(`Guest_${mode}`);

  const created = await emitAck<{ code: string }>(host.socket, 'room:create', { mode });
  if (!created.ok) throw new Error('room:create failed');
  const code = created.data.code;
  check('room created with a 5 char code', code.length === 5, code);

  const joined = await emitAck<{ players: unknown[] }>(guest.socket, 'room:join', { code });
  check('guest joined the room', joined.ok && joined.data.players.length === 2);

  await emitAck(host.socket, 'room:ready', { ready: true });
  await emitAck(guest.socket, 'room:ready', { ready: true });

  const tooEarly = await emitAck(guest.socket, 'room:start');
  check('only the host may start', !tooEarly.ok && tooEarly.code === 'NOT_HOST');

  const results = new Map<string, MatchResult>();
  const roundResults: RoundResultPayload[] = [];
  host.socket.on('round:result', (r: RoundResultPayload) => roundResults.push(r));

  const ended = new Promise<void>((resolve) => {
    let count = 0;
    const onEnd = (bot: Bot) => (result: MatchResult) => {
      results.set(bot.name, result);
      if (++count === 2) resolve();
    };
    host.socket.on('match:end', onEnd(host));
    guest.socket.on('match:end', onEnd(guest));
  });

  const started = await emitAck(host.socket, 'room:start');
  check('host started the match', started.ok);

  await Promise.race([
    ended,
    new Promise((_, reject) => setTimeout(() => reject(new Error('match timed out')), 240_000)),
  ]);

  const result = results.get(host.name) as MatchResult;
  check('both clients received the result', results.size === 2);
  check('rounds played is within bounds', result.roundsPlayed >= 1 && result.roundsPlayed <= TOTAL_ROUNDS, String(result.roundsPlayed));
  check('scores are non-negative', result.players.every((p) => p.score >= 0));
  check('no solution leaked to clients', host.leaked.length === 0 && guest.leaked.length === 0, [...host.leaked, ...guest.leaked].join(', '));
  const afterEnd = await emitAck(host.socket, 'match:answer', {
    roundIndex: 0,
    answer: 0,
    elapsedMs: 10,
  });
  check(
    'answers after the match are rejected',
    !afterEnd.ok && afterEnd.code === 'NOT_IN_MATCH',
  );

  if (mode === 'versus') {
    const [a, b] = result.players;
    const expected = !a || !b ? null : a.score === b.score ? null : a.score > b.score ? a.playerId : b.playerId;
    const livesEnded = result.reason === 'lives';
    check(
      'winner matches the higher score',
      livesEnded || result.winnerId === expected,
      `winner=${result.winnerId} reason=${result.reason}`,
    );
  } else {
    check('co-op reports a team score', typeof result.teamScore === 'number');
    check('co-op reports a team verdict', typeof result.teamVictory === 'boolean');
  }

  console.log(
    `  info  reason=${result.reason} rounds=${result.roundsPlayed} ` +
      result.players.map((p) => `${p.username}:${p.score}(${p.correct}/${p.correct + p.wrong})`).join(' '),
  );

  host.socket.close();
  guest.socket.close();
}

async function testSolo(): Promise<void> {
  console.log('\n--- DAILY CHALLENGE (solo) ---');
  const bot = await createBot('SoloRunner');
  const ended = new Promise<MatchResult>((resolve) => bot.socket.once('match:end', resolve));
  const started = await emitAck(bot.socket, 'solo:start');
  check('solo run started', started.ok);
  const result = await Promise.race([
    ended,
    new Promise<MatchResult>((_, reject) =>
      setTimeout(() => reject(new Error('solo timed out')), 240_000),
    ),
  ]);
  check('solo match has one player', result.players.length === 1);

  const bundle = await emitAck<{ daily: { bestScore: number; completed: boolean } }>(
    bot.socket,
    'session:bundle',
  );
  check(
    'daily challenge was persisted',
    bundle.ok && bundle.data.daily.completed && bundle.data.daily.bestScore === result.players[0]?.score,
  );

  const board = await emitAck<unknown[]>(bot.socket, 'leaderboard:get', { period: 'daily' });
  check('daily leaderboard returns rows', board.ok && board.data.length > 0);
  bot.socket.close();
}

async function testSecurity(): Promise<void> {
  console.log('\n--- SESSION SECURITY ---');
  const victim = await createBot('Victim');
  const attacker = io(URL, { transports: ['websocket'] });
  await new Promise<void>((resolve) => attacker.once('connect', () => resolve()));

  const stolen = await emitAck<{ profile: { id: string; username: string } }>(
    attacker,
    'session:hello',
    { playerId: victim.playerId, token: 'forged-token', username: 'Attacker' },
  );
  check(
    'a forged token cannot adopt another player id',
    stolen.ok && stolen.data.profile.id !== victim.playerId,
  );

  const noSession = io(URL, { transports: ['websocket'] });
  await new Promise<void>((resolve) => noSession.once('connect', () => resolve()));
  const unauth = await emitAck(noSession, 'room:create', { mode: 'versus' });
  check('actions require a session', !unauth.ok && unauth.code === 'NO_SESSION');

  victim.socket.close();
  attacker.close();
  noSession.close();
}

async function main(): Promise<void> {
  await testSecurity();
  await playMatch('versus');
  await playMatch('coop');
  await testSolo();

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('smoke test crashed:', error);
  process.exit(1);
});
