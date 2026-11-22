import type { GameMode } from '@brain-battle/shared';

export interface QueueTicket {
  playerId: string;
  mode: GameMode;
  joinedAt: number;
}

/** FIFO matchmaking queue, one lane per game mode. */
export class Matchmaker {
  private lanes = new Map<GameMode, QueueTicket[]>([
    ['versus', []],
    ['coop', []],
  ]);

  join(playerId: string, mode: GameMode): QueueTicket {
    this.leave(playerId);
    const ticket: QueueTicket = { playerId, mode, joinedAt: Date.now() };
    this.lane(mode).push(ticket);
    return ticket;
  }

  leave(playerId: string): void {
    for (const [mode, lane] of this.lanes) {
      const next = lane.filter((t) => t.playerId !== playerId);
      if (next.length !== lane.length) this.lanes.set(mode, next);
    }
  }

  /** Returns a pair as soon as two players share a lane. */
  pop(mode: GameMode): [QueueTicket, QueueTicket] | null {
    const lane = this.lane(mode);
    if (lane.length < 2) return null;
    const first = lane.shift() as QueueTicket;
    const second = lane.shift() as QueueTicket;
    return [first, second];
  }

  ticketOf(playerId: string): QueueTicket | null {
    for (const lane of this.lanes.values()) {
      const found = lane.find((t) => t.playerId === playerId);
      if (found) return found;
    }
    return null;
  }

  size(mode: GameMode): number {
    return this.lane(mode).length;
  }

  private lane(mode: GameMode): QueueTicket[] {
    let lane = this.lanes.get(mode);
    if (!lane) {
      lane = [];
      this.lanes.set(mode, lane);
    }
    return lane;
  }
}
