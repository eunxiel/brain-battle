import type { GameMode, PlayerProfile, PlayerSlot, RoomState, RoomStatus } from '@brain-battle/shared';
import { newRoomCode } from '../util/ids.js';

export interface RoomMember {
  playerId: string;
  username: string;
  avatarId: string;
  level: number;
  slot: PlayerSlot;
  ready: boolean;
  connected: boolean;
}

export interface Room {
  code: string;
  mode: GameMode;
  hostId: string;
  isPrivate: boolean;
  status: RoomStatus;
  members: Map<string, RoomMember>;
  matchId: string | null;
  createdAt: number;
}

export const MAX_PLAYERS = 2;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private byPlayer = new Map<string, string>();

  create(profile: PlayerProfile, mode: GameMode, isPrivate = true): Room {
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();

    const room: Room = {
      code,
      mode,
      hostId: profile.id,
      isPrivate,
      status: 'lobby',
      members: new Map(),
      matchId: null,
      createdAt: Date.now(),
    };
    room.members.set(profile.id, memberOf(profile, 'A'));
    this.rooms.set(code, room);
    this.byPlayer.set(profile.id, code);
    return room;
  }

  join(code: string, profile: PlayerProfile): Room {
    const room = this.rooms.get(code.toUpperCase().trim());
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'That room code does not exist.');
    if (room.members.has(profile.id)) {
      this.byPlayer.set(profile.id, room.code);
      return room;
    }
    if (room.status !== 'lobby') throw new RoomError('ROOM_IN_MATCH', 'That match already started.');
    if (room.members.size >= MAX_PLAYERS) throw new RoomError('ROOM_FULL', 'That room is full.');

    const takenSlots = new Set([...room.members.values()].map((m) => m.slot));
    const slot: PlayerSlot = takenSlots.has('A') ? 'B' : 'A';
    room.members.set(profile.id, memberOf(profile, slot));
    this.byPlayer.set(profile.id, room.code);
    return room;
  }

  leave(playerId: string): { room: Room | null; closed: boolean } {
    const code = this.byPlayer.get(playerId);
    if (!code) return { room: null, closed: false };
    this.byPlayer.delete(playerId);
    const room = this.rooms.get(code);
    if (!room) return { room: null, closed: false };

    room.members.delete(playerId);
    if (room.members.size === 0) {
      this.rooms.delete(code);
      return { room, closed: true };
    }
    if (room.hostId === playerId) {
      const next = [...room.members.values()][0] as RoomMember;
      room.hostId = next.playerId;
      next.ready = false;
    }
    if (room.status !== 'lobby') room.status = 'lobby';
    for (const member of room.members.values()) member.ready = false;
    return { room, closed: false };
  }

  setReady(playerId: string, ready: boolean): Room {
    const room = this.requireRoomOf(playerId);
    const member = room.members.get(playerId);
    if (member) member.ready = ready;
    return room;
  }

  setConnected(playerId: string, connected: boolean): Room | null {
    const room = this.getByPlayer(playerId);
    if (!room) return null;
    const member = room.members.get(playerId);
    if (member) member.connected = connected;
    return room;
  }

  setStatus(code: string, status: RoomStatus, matchId: string | null = null): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.status = status;
    room.matchId = matchId;
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase().trim());
  }

  getByPlayer(playerId: string): Room | null {
    const code = this.byPlayer.get(playerId);
    return (code && this.rooms.get(code)) || null;
  }

  requireRoomOf(playerId: string): Room {
    const room = this.getByPlayer(playerId);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'You are not in a room.');
    return room;
  }

  canStart(room: Room): boolean {
    return (
      room.status === 'lobby' &&
      room.members.size === MAX_PLAYERS &&
      [...room.members.values()].every((m) => m.ready && m.connected)
    );
  }

  /** Drops rooms that were abandoned without a clean leave. */
  sweep(maxIdleMs = 2 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const stale = now - room.createdAt > maxIdleMs;
      const empty = room.members.size === 0;
      const allGone = [...room.members.values()].every((m) => !m.connected);
      if (empty || (stale && allGone)) {
        for (const member of room.members.keys()) this.byPlayer.delete(member);
        this.rooms.delete(code);
      }
    }
  }
}

export function toRoomState(room: Room): RoomState {
  return {
    code: room.code,
    mode: room.mode,
    status: room.status,
    hostId: room.hostId,
    isPrivate: room.isPrivate,
    players: [...room.members.values()]
      .sort((a, b) => a.slot.localeCompare(b.slot))
      .map((m) => ({
        id: m.playerId,
        username: m.username,
        avatarId: m.avatarId,
        level: m.level,
        slot: m.slot,
        isHost: m.playerId === room.hostId,
        ready: m.ready,
        connected: m.connected,
      })),
  };
}

export class RoomError extends Error {
  constructor(
    public code:
      | 'ROOM_NOT_FOUND'
      | 'ROOM_FULL'
      | 'ROOM_IN_MATCH'
      | 'NOT_HOST'
      | 'NOT_READY'
      | 'ALREADY_IN_ROOM',
    message: string,
  ) {
    super(message);
  }
}

function memberOf(profile: PlayerProfile, slot: PlayerSlot): RoomMember {
  return {
    playerId: profile.id,
    username: profile.username,
    avatarId: profile.avatarId,
    level: profile.level,
    slot,
    ready: false,
    connected: true,
  };
}
