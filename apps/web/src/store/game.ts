import { create } from 'zustand';
import type {
  GameMode,
  MatchResult,
  MatchSnapshot,
  MatchStartPayload,
  PublicPlayer,
  RoomState,
  RoundMeta,
  RoundResultPayload,
  RoundStartPayload,
} from '@brain-battle/shared';
import { request, socket } from '../net/socket';
import { toast } from './ui';

export type ArenaPhase = 'idle' | 'countdown' | 'intro' | 'playing' | 'result' | 'ended';

interface QueueState {
  searching: boolean;
  mode: GameMode | null;
  waitingMs: number;
  playersSearching: number;
}

interface GameState {
  /** Mode chosen on the mode-select screen; drives lobby + matchmaking. */
  mode: GameMode;
  room: RoomState | null;
  queue: QueueState;
  matchFoundWith: PublicPlayer | null;

  matchId: string | null;
  matchMode: GameMode;
  solo: boolean;
  roster: PublicPlayer[];
  snapshot: MatchSnapshot | null;
  phase: ArenaPhase;
  startsAt: number | null;
  meta: RoundMeta | null;
  round: RoundStartPayload | null;
  roundResult: RoundResultPayload | null;
  answered: boolean;
  opponentAnswered: boolean;
  opponentConnected: boolean;
  disconnectGraceUntil: number | null;
  result: MatchResult | null;

  setMode: (mode: GameMode) => void;
  createRoom: (mode: GameMode) => Promise<string | null>;
  joinRoom: (code: string) => Promise<boolean>;
  setReady: (ready: boolean) => Promise<void>;
  leaveRoom: () => Promise<void>;
  startMatch: () => Promise<boolean>;
  joinQueue: (mode: GameMode) => Promise<boolean>;
  leaveQueue: () => Promise<void>;
  startSolo: () => Promise<boolean>;
  submitAnswer: (answer: unknown, elapsedMs: number) => void;
  leaveMatch: () => Promise<void>;
  clearResult: () => void;
  resetMatch: () => void;
}

/** Set while the player forfeits, so the incoming result is discarded once. */
let leftVoluntarily = false;

const emptyQueue: QueueState = {
  searching: false,
  mode: null,
  waitingMs: 0,
  playersSearching: 0,
};

const emptyMatch = {
  matchId: null,
  roster: [] as PublicPlayer[],
  snapshot: null,
  phase: 'idle' as ArenaPhase,
  startsAt: null,
  meta: null,
  round: null,
  roundResult: null,
  answered: false,
  opponentAnswered: false,
  opponentConnected: true,
  disconnectGraceUntil: null,
  solo: false,
};

export const useGameStore = create<GameState>((set, get) => ({
  mode: 'versus',
  room: null,
  queue: emptyQueue,
  matchFoundWith: null,
  matchMode: 'versus',
  result: null,
  ...emptyMatch,

  setMode: (mode) => set({ mode }),

  createRoom: async (mode) => {
    const res = await request<RoomState>('room:create', { mode });
    if (!res.ok) {
      toast('error', res.message);
      return null;
    }
    set({ room: res.data, mode });
    return res.data.code;
  },

  joinRoom: async (code) => {
    const res = await request<RoomState>('room:join', { code: code.toUpperCase().trim() });
    if (!res.ok) {
      toast('error', res.message);
      return false;
    }
    set({ room: res.data, mode: res.data.mode });
    return true;
  },

  setReady: async (ready) => {
    const res = await request<RoomState>('room:ready', { ready });
    if (res.ok) set({ room: res.data });
    else toast('error', res.message);
  },

  leaveRoom: async () => {
    await request('room:leave');
    set({ room: null, matchFoundWith: null });
  },

  startMatch: async () => {
    const res = await request('room:start');
    if (!res.ok) toast('warning', res.message);
    return res.ok;
  },

  joinQueue: async (mode) => {
    const res = await request('queue:join', { mode });
    if (!res.ok) {
      toast('error', res.message);
      return false;
    }
    set({ queue: { searching: true, mode, waitingMs: 0, playersSearching: 1 }, mode });
    return true;
  },

  leaveQueue: async () => {
    await request('queue:leave');
    set({ queue: emptyQueue, matchFoundWith: null });
  },

  startSolo: async () => {
    const res = await request('solo:start');
    if (!res.ok) {
      toast('error', res.message);
      return false;
    }
    set({ solo: true, result: null });
    return true;
  },

  submitAnswer: (answer, elapsedMs) => {
    const { round, answered } = get();
    if (!round || answered) return;
    set({ answered: true });
    socket.emit(
      'match:answer',
      { roundIndex: round.roundIndex, answer, elapsedMs: Math.round(elapsedMs) },
      () => undefined,
    );
  },

  leaveMatch: async () => {
    // The server still ends the match and broadcasts a result; the player who
    // walked away should not be dragged onto the result screen by it.
    leftVoluntarily = true;
    await request('match:leave');
    set({ ...emptyMatch, room: null, result: null });
  },

  clearResult: () => set({ result: null }),
  resetMatch: () => set({ ...emptyMatch }),
}));

/** Wires every server event into the store. Called once at boot. */
export function attachGameListeners(): void {
  socket.on('room:update', (room) => useGameStore.setState({ room }));

  socket.on('room:closed', ({ reason }) => {
    useGameStore.setState({ room: null, matchFoundWith: null });
    toast('warning', reason);
  });

  socket.on('queue:update', (update) => {
    if (update.status === 'searching') {
      useGameStore.setState({
        queue: {
          searching: true,
          mode: update.mode,
          waitingMs: update.waitingMs,
          playersSearching: update.playersSearching,
        },
      });
    } else {
      useGameStore.setState({ queue: emptyQueue });
    }
  });

  socket.on('match:found', ({ room, opponent }) => {
    useGameStore.setState({
      room,
      matchFoundWith: opponent,
      queue: { ...emptyQueue, mode: room.mode },
    });
  });

  socket.on('match:start', (payload: MatchStartPayload) => {
    useGameStore.setState({
      ...emptyMatch,
      solo: payload.players.length === 1,
      matchId: payload.snapshot.matchId,
      matchMode: payload.mode,
      roster: payload.players,
      snapshot: payload.snapshot,
      startsAt: payload.startsAt,
      phase: 'countdown',
      result: null,
      matchFoundWith: null,
      queue: emptyQueue,
    });
  });

  socket.on('round:intro', (meta: RoundMeta) => {
    useGameStore.setState({
      meta,
      phase: 'intro',
      round: null,
      roundResult: null,
      answered: false,
      opponentAnswered: false,
    });
  });

  socket.on('round:start', (round: RoundStartPayload) => {
    useGameStore.setState({
      round,
      phase: 'playing',
      roundResult: null,
      answered: false,
      opponentAnswered: false,
    });
  });

  socket.on('round:progress', () => useGameStore.setState({ opponentAnswered: true }));

  socket.on('round:result', (result: RoundResultPayload) => {
    useGameStore.setState({
      roundResult: result,
      snapshot: result.snapshot,
      phase: 'result',
    });
  });

  socket.on('match:end', (result: MatchResult) => {
    if (leftVoluntarily) {
      leftVoluntarily = false;
      useGameStore.setState({ ...emptyMatch, result: null });
      return;
    }
    useGameStore.setState({ result, phase: 'ended', round: null, meta: null });
  });

  socket.on('player:connection', ({ connected, graceMs }) => {
    useGameStore.setState({
      opponentConnected: connected,
      disconnectGraceUntil: connected ? null : Date.now() + graceMs,
    });
    toast(
      connected ? 'success' : 'warning',
      connected ? 'Your opponent is back!' : 'Your opponent lost connection…',
    );
  });

  socket.on('notice', ({ kind, message }) => toast(kind, message));
}
