import type { Server, Socket } from 'socket.io';
import {
  evaluateAchievements,
  levelForXp,
  xpFromMatch,
  type Ack,
  type ClientToServerEvents,
  type ErrorCode,
  type GameMode,
  type LeaderboardPeriod,
  type MatchHistoryEntry,
  type MatchResult,
  type PlayerProfile,
  type ServerToClientEvents,
} from '@brain-battle/shared';
import type { MatchRecordPlayer, Store } from '../db/index.js';
import { dailyPlan } from '../game/daily.js';
import { Match, type MatchParticipant } from '../game/matchEngine.js';
import { Matchmaker } from '../game/matchmaker.js';
import { RoomError, RoomManager, toRoomState, type Room } from '../game/rooms.js';
import type { ProfileService } from '../game/profiles.js';
import { newId, todayKey } from '../util/ids.js';
import { signPlayerId, verifyPlayerToken } from './tokens.js';

type BBServer = Server<ClientToServerEvents, ServerToClientEvents>;
type BBSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const ok = <T,>(data: T): Ack<T> => ({ ok: true, data });
const fail = (code: ErrorCode, message: string): Ack<never> => ({ ok: false, code, message });

const MATCH_FOUND_DELAY_MS = 1800;

export class GameServer {
  private rooms = new RoomManager();
  private matchmaker = new Matchmaker();
  private matches = new Map<string, Match>();
  private playerMatch = new Map<string, string>();
  private socketPlayer = new Map<string, string>();
  private playerSockets = new Map<string, Set<string>>();
  private intervals: NodeJS.Timeout[] = [];

  constructor(
    private io: BBServer,
    private store: Store,
    private profiles: ProfileService,
  ) {
    this.intervals.push(setInterval(() => this.broadcastQueueStatus(), 1000));
    this.intervals.push(setInterval(() => this.rooms.sweep(), 5 * 60 * 1000));
  }

  dispose(): void {
    for (const interval of this.intervals) clearInterval(interval);
    for (const match of this.matches.values()) match.destroy();
  }

  // ------------------------------------------------------------- socket setup

  handleConnection(socket: BBSocket): void {
    socket.on('session:hello', (payload, cb) => void this.onHello(socket, payload, cb));
    socket.on('time:ping', (cb) => cb(Date.now()));

    socket.on('session:profile', (payload, cb) =>
      void this.guard(socket, cb, async (playerId) => {
        const profile = await this.profiles.update(playerId, payload);
        if (!profile) return fail('NO_SESSION', 'Unknown player.');
        const room = this.rooms.getByPlayer(playerId);
        if (room) {
          const member = room.members.get(playerId);
          if (member) {
            member.username = profile.username;
            member.avatarId = profile.avatarId;
            member.level = profile.level;
          }
          this.broadcastRoom(room);
        }
        return ok(profile);
      }),
    );

    socket.on('session:bundle', (cb) =>
      void this.guard(socket, cb, async (playerId) => {
        const profile = await this.profiles.get(playerId);
        if (!profile) return fail('NO_SESSION', 'Unknown player.');
        const [history, daily] = await Promise.all([
          this.store.getHistory(playerId, 20),
          this.store.getDaily(playerId),
        ]);
        return ok({ profile, history, daily });
      }),
    );

    socket.on('room:create', (payload, cb) =>
      void this.guard(socket, cb, async (playerId) => {
        if (!isMode(payload?.mode)) return fail('INVALID_INPUT', 'Pick a game mode first.');
        this.matchmaker.leave(playerId);
        this.exitCurrentRoom(playerId);
        const profile = await this.requireProfile(playerId);
        const room = this.rooms.create(profile, payload.mode, true);
        void socket.join(roomChannel(room.code));
        this.broadcastRoom(room);
        return ok(toRoomState(room));
      }),
    );

    socket.on('room:join', (payload, cb) =>
      void this.guard(socket, cb, async (playerId) => {
        const code = typeof payload?.code === 'string' ? payload.code.toUpperCase().trim() : '';
        if (code.length < 4) return fail('INVALID_INPUT', 'Enter a valid room code.');
        const profile = await this.requireProfile(playerId);
        this.matchmaker.leave(playerId);
        const current = this.rooms.getByPlayer(playerId);
        if (current && current.code !== code) this.exitCurrentRoom(playerId);
        try {
          const room = this.rooms.join(code, profile);
          void socket.join(roomChannel(room.code));
          this.broadcastRoom(room);
          return ok(toRoomState(room));
        } catch (error) {
          if (error instanceof RoomError) return fail(error.code, error.message);
          throw error;
        }
      }),
    );

    socket.on('room:ready', (payload, cb) =>
      void this.guard(socket, cb, async (playerId) => {
        try {
          const room = this.rooms.setReady(playerId, Boolean(payload?.ready));
          this.broadcastRoom(room);
          return ok(toRoomState(room));
        } catch (error) {
          if (error instanceof RoomError) return fail(error.code, error.message);
          throw error;
        }
      }),
    );

    socket.on('room:start', (cb) =>
      void this.guard(socket, cb, async (playerId) => {
        const room = this.rooms.getByPlayer(playerId);
        if (!room) return fail('ROOM_NOT_FOUND', 'You are not in a room.');
        if (room.hostId !== playerId) return fail('NOT_HOST', 'Only the host can start the match.');
        if (!this.rooms.canStart(room)) {
          return fail('NOT_READY', 'Both players must be connected and ready.');
        }
        this.startMatch(room);
        return ok(null);
      }),
    );

    socket.on('room:leave', (cb) =>
      void this.guard(socket, cb, async (playerId) => {
        this.exitCurrentRoom(playerId, socket);
        return ok(null);
      }),
    );

    socket.on('queue:join', (payload, cb) =>
      void this.guard(socket, cb, async (playerId) => {
        if (!isMode(payload?.mode)) return fail('INVALID_INPUT', 'Pick a game mode first.');
        if (this.playerMatch.has(playerId)) return fail('ROOM_IN_MATCH', 'You are already in a match.');
        this.exitCurrentRoom(playerId, socket);
        this.matchmaker.join(playerId, payload.mode);
        this.emitToPlayer(playerId, 'queue:update', {
          status: 'searching',
          mode: payload.mode,
          waitingMs: 0,
          playersSearching: this.matchmaker.size(payload.mode),
        });
        void this.tryMatchmake(payload.mode);
        return ok(null);
      }),
    );

    socket.on('queue:leave', (cb) =>
      void this.guard(socket, cb, async (playerId) => {
        const ticket = this.matchmaker.ticketOf(playerId);
        this.matchmaker.leave(playerId);
        if (ticket) {
          this.emitToPlayer(playerId, 'queue:update', {
            status: 'cancelled',
            mode: ticket.mode,
            waitingMs: Date.now() - ticket.joinedAt,
            playersSearching: this.matchmaker.size(ticket.mode),
          });
        }
        return ok(null);
      }),
    );

    socket.on('match:answer', (payload, cb) =>
      void this.guard(socket, cb, async (playerId) => {
        const match = this.matchOf(playerId);
        if (!match) return fail('NOT_IN_MATCH', 'No active match.');
        if (typeof payload?.roundIndex !== 'number') return fail('INVALID_INPUT', 'Bad answer.');
        const elapsed = Number(payload.elapsedMs);
        const result = match.submitAnswer(
          playerId,
          payload.roundIndex,
          payload.answer,
          Number.isFinite(elapsed) ? elapsed : 0,
        );
        return ok({ accepted: result.accepted });
      }),
    );

    socket.on('match:leave', (cb) =>
      void this.guard(socket, cb, async (playerId) => {
        const match = this.matchOf(playerId);
        if (match) match.leave(playerId);
        this.exitCurrentRoom(playerId, socket);
        return ok(null);
      }),
    );

    socket.on('solo:start', (cb) =>
      void this.guard(socket, cb, async (playerId) => {
        if (this.playerMatch.has(playerId)) return fail('ROOM_IN_MATCH', 'Finish your match first.');
        const profile = await this.requireProfile(playerId);
        this.exitCurrentRoom(playerId, socket);
        this.startSoloMatch(profile);
        return ok(null);
      }),
    );

    socket.on('leaderboard:get', (payload, cb) =>
      void this.guard(socket, cb, async () => {
        const period: LeaderboardPeriod = isPeriod(payload?.period) ? payload.period : 'daily';
        return ok(await this.store.getLeaderboard(period, 50));
      }),
    );

    socket.on('disconnect', () => this.onDisconnect(socket));
  }

  // ----------------------------------------------------------------- sessions

  private async onHello(
    socket: BBSocket,
    payload: { playerId: string | null; token?: string | null; username?: string; avatarId?: string },
    cb: (res: Ack<{ profile: PlayerProfile; token: string; serverNow: number; activeRoom: ReturnType<typeof toRoomState> | null }>) => void,
  ): Promise<void> {
    try {
      const claimedId = typeof payload?.playerId === 'string' ? payload.playerId : null;
      const trusted = claimedId && verifyPlayerToken(claimedId, payload?.token) ? claimedId : null;
      const profile = await this.profiles.resolve(trusted, {
        username: payload?.username,
        avatarId: payload?.avatarId,
      });

      this.bindSocket(socket, profile.id);

      const room = this.rooms.setConnected(profile.id, true);
      if (room) {
        void socket.join(roomChannel(room.code));
        this.broadcastRoom(room);
      }
      const match = this.matchOf(profile.id);
      if (match) {
        match.setConnected(profile.id, true);
        setTimeout(() => match.resume(profile.id), 120);
      }

      cb(
        ok({
          profile,
          token: signPlayerId(profile.id),
          serverNow: Date.now(),
          activeRoom: room ? toRoomState(room) : null,
        }),
      );
    } catch (error) {
      console.error('[hello] failed', error);
      cb(fail('SERVER_ERROR', 'Could not start your session.'));
    }
  }

  private bindSocket(socket: BBSocket, playerId: string): void {
    this.socketPlayer.set(socket.id, playerId);
    const set = this.playerSockets.get(playerId) ?? new Set<string>();
    set.add(socket.id);
    this.playerSockets.set(playerId, set);
    void socket.join(playerChannel(playerId));
  }

  private onDisconnect(socket: BBSocket): void {
    const playerId = this.socketPlayer.get(socket.id);
    this.socketPlayer.delete(socket.id);
    if (!playerId) return;

    const sockets = this.playerSockets.get(playerId);
    sockets?.delete(socket.id);
    if (sockets && sockets.size > 0) return; // another tab is still connected

    this.playerSockets.delete(playerId);
    this.matchmaker.leave(playerId);

    const room = this.rooms.setConnected(playerId, false);
    if (room) {
      const member = room.members.get(playerId);
      if (member) member.ready = false;
      this.broadcastRoom(room);
    }
    const match = this.matchOf(playerId);
    if (match) match.setConnected(playerId, false);
  }

  private exitCurrentRoom(playerId: string, socket?: BBSocket): void {
    const current = this.rooms.getByPlayer(playerId);
    if (!current) return;
    const { room, closed } = this.rooms.leave(playerId);
    if (socket) void socket.leave(roomChannel(current.code));
    if (!room) return;
    if (closed) {
      this.io.to(roomChannel(room.code)).emit('room:closed', { reason: 'The room was closed.' });
      return;
    }
    this.broadcastRoom(room);
    this.io.to(roomChannel(room.code)).emit('notice', {
      kind: 'warning',
      message: 'Your opponent left the room.',
    });
  }

  // -------------------------------------------------------------- matchmaking

  private async tryMatchmake(mode: GameMode): Promise<void> {
    const pair = this.matchmaker.pop(mode);
    if (!pair) return;
    const [first, second] = pair;

    const [profileA, profileB] = await Promise.all([
      this.profiles.get(first.playerId),
      this.profiles.get(second.playerId),
    ]);
    // A player may have vanished between queueing and pairing.
    if (!profileA || !this.playerSockets.has(first.playerId)) {
      if (profileB && this.playerSockets.has(second.playerId)) {
        this.matchmaker.join(second.playerId, mode);
      }
      return;
    }
    if (!profileB || !this.playerSockets.has(second.playerId)) {
      this.matchmaker.join(first.playerId, mode);
      return;
    }

    const room = this.rooms.create(profileA, mode, false);
    this.rooms.join(room.code, profileB);
    for (const member of room.members.values()) member.ready = true;

    for (const playerId of [first.playerId, second.playerId]) {
      for (const socketId of this.playerSockets.get(playerId) ?? []) {
        void this.io.sockets.sockets.get(socketId)?.join(roomChannel(room.code));
      }
    }

    const state = toRoomState(room);
    this.emitToPlayer(first.playerId, 'match:found', {
      room: state,
      opponent: state.players.find((p) => p.id === second.playerId)!,
    });
    this.emitToPlayer(second.playerId, 'match:found', {
      room: state,
      opponent: state.players.find((p) => p.id === first.playerId)!,
    });

    setTimeout(() => {
      const live = this.rooms.get(room.code);
      if (!live || live.status !== 'lobby') return;
      if ([...live.members.values()].some((m) => !m.connected)) {
        this.io.to(roomChannel(room.code)).emit('notice', {
          kind: 'error',
          message: 'Your opponent dropped out. Search again?',
        });
        return;
      }
      this.startMatch(live);
    }, MATCH_FOUND_DELAY_MS);
  }

  /** Each searching player gets their own waiting time and lane size. */
  private broadcastQueueStatus(): void {
    for (const playerId of this.playerSockets.keys()) {
      const ticket = this.matchmaker.ticketOf(playerId);
      if (!ticket) continue;
      this.emitToPlayer(playerId, 'queue:update', {
        status: 'searching',
        mode: ticket.mode,
        waitingMs: Date.now() - ticket.joinedAt,
        playersSearching: this.matchmaker.size(ticket.mode),
      });
    }
  }

  // ------------------------------------------------------------------ matches

  private startMatch(room: Room): void {
    const participants: MatchParticipant[] = [...room.members.values()].map((m) => ({
      playerId: m.playerId,
      slot: m.slot,
      username: m.username,
      avatarId: m.avatarId,
      level: m.level,
    }));

    const matchId = newId();
    const match = new Match({
      matchId,
      mode: room.mode,
      roomCode: room.code,
      solo: false,
      participants,
      hooks: {
        emitToPlayer: (playerId, event, payload) => this.emitToPlayer(playerId, event, payload),
        emitAll: (event, payload) => {
          for (const participant of participants) {
            this.emitToPlayer(participant.playerId, event, payload);
          }
        },
        onFinished: (result) => void this.finalizeMatch(result, room.code),
      },
    });

    this.matches.set(matchId, match);
    for (const participant of participants) this.playerMatch.set(participant.playerId, matchId);
    this.rooms.setStatus(room.code, 'in-match', matchId);
    this.broadcastRoom(room);
    match.start();
  }

  private startSoloMatch(profile: PlayerProfile): void {
    const matchId = newId();
    const match = new Match({
      matchId,
      mode: 'versus',
      roomCode: 'DAILY',
      solo: true,
      plan: dailyPlan(todayKey()),
      participants: [
        {
          playerId: profile.id,
          slot: 'A',
          username: profile.username,
          avatarId: profile.avatarId,
          level: profile.level,
        },
      ],
      hooks: {
        emitToPlayer: (playerId, event, payload) => this.emitToPlayer(playerId, event, payload),
        emitAll: (event, payload) => this.emitToPlayer(profile.id, event, payload),
        onFinished: (result) => void this.finalizeMatch(result, null, true),
      },
    });
    this.matches.set(matchId, match);
    this.playerMatch.set(profile.id, matchId);
    match.start();
  }

  private matchOf(playerId: string): Match | null {
    const matchId = this.playerMatch.get(playerId);
    if (!matchId) return null;
    return this.matches.get(matchId) ?? null;
  }

  private async finalizeMatch(
    result: MatchResult,
    roomCode: string | null,
    solo = false,
  ): Promise<void> {
    const match = this.matches.get(result.matchId);
    const recordPlayers: MatchRecordPlayer[] = [];
    const unlockedByPlayer = new Map<string, string[]>();

    for (const entry of result.players) {
      const opponent = result.players.find((p) => p.playerId !== entry.playerId);
      const outcome = outcomeFor(result, entry.playerId, solo);
      const won = outcome === 'win' || outcome === 'team-win';
      const xpGained = xpFromMatch(entry.score, won, result.roundsPlayed);
      entry.xpGained = xpGained;

      const profile = await this.profiles.get(entry.playerId);
      if (!profile) continue;

      const totalAnswers = profile.totalCorrect + profile.totalWrong;
      const nextTotalAnswers = totalAnswers + entry.correct + entry.wrong;
      const blendedResponse =
        entry.avgResponseMs > 0
          ? Math.round(
              (profile.avgResponseMs * totalAnswers + entry.avgResponseMs * entry.correct) /
                Math.max(1, totalAnswers + entry.correct),
            )
          : profile.avgResponseMs;

      const updated: PlayerProfile = {
        ...profile,
        xp: profile.xp + xpGained,
        level: levelForXp(profile.xp + xpGained),
        totalMatches: profile.totalMatches + 1,
        wins: profile.wins + (won ? 1 : 0),
        losses: profile.losses + (outcome === 'loss' || outcome === 'team-loss' ? 1 : 0),
        draws: profile.draws + (outcome === 'draw' ? 1 : 0),
        bestScore: Math.max(profile.bestScore, entry.score),
        totalCorrect: profile.totalCorrect + entry.correct,
        totalWrong: profile.totalWrong + entry.wrong,
        avgResponseMs: nextTotalAnswers ? blendedResponse : profile.avgResponseMs,
      };

      const unlocked = evaluateAchievements({
        profile: updated,
        mode: result.mode,
        matchScore: entry.score,
        correct: entry.correct,
        wrong: entry.wrong,
        bestStreak: entry.bestStreak,
        avgResponseMs: entry.avgResponseMs,
        livesLeft: entry.livesLeft,
        won,
        teamVictory: result.teamVictory,
        perfectRounds: entry.wrong === 0,
      });
      updated.achievements = [...updated.achievements, ...unlocked];
      unlockedByPlayer.set(entry.playerId, unlocked);

      const saved = await this.profiles.save(updated);
      this.emitToPlayer(entry.playerId, 'profile:update', saved);

      recordPlayers.push({
        playerId: entry.playerId,
        score: entry.score,
        correct: entry.correct,
        wrong: entry.wrong,
        bestStreak: entry.bestStreak,
        avgResponseMs: entry.avgResponseMs,
        livesLeft: entry.livesLeft,
        outcome,
        opponentName: solo ? 'Daily Challenge' : opponent?.username ?? 'Unknown',
        opponentAvatarId: solo ? 'nova' : opponent?.avatarId ?? 'nova',
        xpGained,
      });

      if (solo) await this.store.recordDaily(entry.playerId, entry.score);
    }

    try {
      await this.store.recordMatch({
        matchId: result.matchId,
        mode: result.mode,
        solo,
        roundsPlayed: result.roundsPlayed,
        playedAt: result.finishedAt,
        players: recordPlayers,
      });
    } catch (error) {
      console.error('[match] could not persist result', error);
    }

    for (const entry of result.players) {
      this.emitToPlayer(entry.playerId, 'match:end', {
        ...result,
        unlockedAchievements: unlockedByPlayer.get(entry.playerId) ?? [],
      });
      this.playerMatch.delete(entry.playerId);
    }

    match?.destroy();
    this.matches.delete(result.matchId);

    if (roomCode) {
      const room = this.rooms.get(roomCode);
      if (room) {
        room.status = 'lobby';
        room.matchId = null;
        for (const member of room.members.values()) member.ready = false;
        this.broadcastRoom(room);
      }
    }
  }

  // ------------------------------------------------------------------ helpers

  private emitToPlayer<E extends keyof ServerToClientEvents>(
    playerId: string,
    event: E,
    payload: Parameters<ServerToClientEvents[E]>[0],
  ): void {
    // Socket.IO cannot narrow a generic event key; the public signature above
    // keeps every call site type-safe.
    const channel = this.io.to(playerChannel(playerId)) as unknown as {
      emit: (event: string, payload: unknown) => void;
    };
    channel.emit(event, payload);
  }

  private broadcastRoom(room: Room): void {
    this.io.to(roomChannel(room.code)).emit('room:update', toRoomState(room));
  }

  private async requireProfile(playerId: string): Promise<PlayerProfile> {
    const profile = await this.profiles.get(playerId);
    if (!profile) throw new Error('missing profile');
    return profile;
  }

  /** Resolves the caller's player id and converts thrown errors into acks. */
  private async guard<T>(
    socket: BBSocket,
    cb: ((res: Ack<T>) => void) | undefined,
    handler: (playerId: string) => Promise<Ack<T>>,
  ): Promise<void> {
    const respond = typeof cb === 'function' ? cb : () => undefined;
    const playerId = this.socketPlayer.get(socket.id);
    if (!playerId) {
      respond(fail('NO_SESSION', 'Session expired — refresh the page.'));
      return;
    }
    try {
      respond(await handler(playerId));
    } catch (error) {
      console.error('[socket] handler failed', error);
      respond(fail('SERVER_ERROR', 'Something went wrong on our side.'));
    }
  }
}

function outcomeFor(
  result: MatchResult,
  playerId: string,
  solo: boolean,
): MatchHistoryEntry['outcome'] {
  if (result.mode === 'coop') return result.teamVictory ? 'team-win' : 'team-loss';
  if (solo) return result.reason === 'completed' ? 'win' : 'loss';
  if (!result.winnerId) return 'draw';
  return result.winnerId === playerId ? 'win' : 'loss';
}

const isMode = (value: unknown): value is GameMode => value === 'versus' || value === 'coop';
const isPeriod = (value: unknown): value is LeaderboardPeriod =>
  value === 'daily' || value === 'weekly' || value === 'all-time';

const playerChannel = (playerId: string): string => `player:${playerId}`;
const roomChannel = (code: string): string => `room:${code}`;
