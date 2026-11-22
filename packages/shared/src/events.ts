import type {
  DailyChallengeState,
  GameMode,
  LeaderboardEntry,
  LeaderboardPeriod,
  MatchHistoryEntry,
  MatchResult,
  MatchSnapshot,
  PlayerProfile,
  PublicPlayer,
  RoomState,
  RoundMeta,
  RoundResultPayload,
  RoundStartPayload,
} from './types.js';

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_IN_MATCH'
  | 'NOT_HOST'
  | 'NOT_READY'
  | 'NO_SESSION'
  | 'INVALID_INPUT'
  | 'ALREADY_IN_ROOM'
  | 'NOT_IN_MATCH'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR';

export type Ack<T> = { ok: true; data: T } | { ok: false; code: ErrorCode; message: string };

export interface HelloPayload {
  playerId: string | null;
  /** Proof that this client owns `playerId`; issued by the server on first hello. */
  token?: string | null;
  username?: string;
  avatarId?: string;
}

export interface HelloResult {
  profile: PlayerProfile;
  /** Store alongside the player id and send it back on every reconnect. */
  token: string;
  serverNow: number;
  /** Set when the player was mid-match and can rejoin. */
  activeRoom: RoomState | null;
}

export interface MatchStartPayload {
  snapshot: MatchSnapshot;
  players: PublicPlayer[];
  mode: GameMode;
  startsAt: number;
  roomCode: string;
}

export interface QueueUpdate {
  status: 'searching' | 'matched' | 'cancelled';
  mode: GameMode;
  waitingMs: number;
  playersSearching: number;
}

export interface ProfileBundle {
  profile: PlayerProfile;
  history: MatchHistoryEntry[];
  daily: DailyChallengeState;
}

export interface ClientToServerEvents {
  'session:hello': (payload: HelloPayload, cb: (res: Ack<HelloResult>) => void) => void;
  'session:profile': (
    payload: { username: string; avatarId: string },
    cb: (res: Ack<PlayerProfile>) => void,
  ) => void;
  'session:bundle': (cb: (res: Ack<ProfileBundle>) => void) => void;
  'time:ping': (cb: (serverNow: number) => void) => void;

  'room:create': (payload: { mode: GameMode }, cb: (res: Ack<RoomState>) => void) => void;
  'room:join': (payload: { code: string }, cb: (res: Ack<RoomState>) => void) => void;
  'room:leave': (cb: (res: Ack<null>) => void) => void;
  'room:ready': (payload: { ready: boolean }, cb: (res: Ack<RoomState>) => void) => void;
  'room:start': (cb: (res: Ack<null>) => void) => void;

  'queue:join': (payload: { mode: GameMode }, cb: (res: Ack<null>) => void) => void;
  'queue:leave': (cb: (res: Ack<null>) => void) => void;

  'match:answer': (
    payload: { roundIndex: number; answer: unknown; elapsedMs: number },
    cb: (res: Ack<{ accepted: boolean }>) => void,
  ) => void;
  'match:leave': (cb: (res: Ack<null>) => void) => void;

  'solo:start': (cb: (res: Ack<null>) => void) => void;

  'leaderboard:get': (
    payload: { period: LeaderboardPeriod },
    cb: (res: Ack<LeaderboardEntry[]>) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'room:update': (room: RoomState) => void;
  'room:closed': (payload: { reason: string }) => void;
  'queue:update': (payload: QueueUpdate) => void;
  'match:found': (payload: { room: RoomState; opponent: PublicPlayer }) => void;
  'match:start': (payload: MatchStartPayload) => void;
  'round:intro': (meta: RoundMeta) => void;
  'round:start': (payload: RoundStartPayload) => void;
  'round:progress': (payload: { playerId: string; answered: boolean }) => void;
  'round:result': (payload: RoundResultPayload) => void;
  'match:end': (result: MatchResult) => void;
  'player:connection': (payload: {
    playerId: string;
    connected: boolean;
    graceMs: number;
  }) => void;
  'profile:update': (profile: PlayerProfile) => void;
  notice: (payload: { kind: 'info' | 'success' | 'warning' | 'error'; message: string }) => void;
}
