import type { MiniGameDefinition } from './types.js';

export interface BarZone {
  /** 0..1 along the track. */
  center: number;
  width: number;
}

export interface StopTheBarPayload {
  /** Tracks per second. */
  speed: number;
  startPos: number;
  direction: 1 | -1;
  zones: { A: BarZone; B: BarZone };
  /** Co-op: your own zone is invisible, your partner can see it. */
  blindfolded: boolean;
}

export interface StopTheBarView {
  speed: number;
  startPos: number;
  direction: 1 | -1;
  /** Null in co-op — you cannot see where you must stop. */
  ownZone: BarZone | null;
  /** Co-op only — the zone your PARTNER has to hit. Describe it to them. */
  partnerZone: BarZone | null;
  blindfolded: boolean;
}

export interface StopTheBarAnswer {
  /** Milliseconds after round start at which the player pressed STOP. */
  elapsedMs: number;
}

/** Shared motion model — client renders it, server grades it. Ping-pong track. */
export function barPositionAt(
  motion: Pick<StopTheBarPayload, 'speed' | 'startPos' | 'direction'>,
  elapsedMs: number,
): number {
  const raw = motion.startPos + motion.direction * motion.speed * (elapsedMs / 1000);
  const folded = ((raw % 2) + 2) % 2;
  return folded <= 1 ? folded : 2 - folded;
}

export const stopTheBar: MiniGameDefinition<StopTheBarPayload, StopTheBarAnswer> = {
  id: 'stop-the-bar',
  title: 'Stop The Bar',
  tagline: 'Nail the green zone.',
  instruction: 'The marker is racing. Hit STOP while it is inside the target zone.',
  coopInstruction:
    'You cannot see your own target — but you can see your partner\'s. Talk them in while they talk you in.',
  category: 'reaction',
  accent: 'mint',
  icon: 'bar',
  coopStyle: 'split',

  durationMs(difficulty, mode) {
    return Math.round((7000 - difficulty * 180) * (mode === 'coop' ? 1.5 : 1));
  },

  generate({ difficulty, rng, mode }) {
    const width = Math.max(0.055, 0.26 - difficulty * 0.019);
    const makeZone = (): BarZone => ({
      center: Math.round(rng.float(0.18, 0.82) * 1000) / 1000,
      width: Math.round(width * 1000) / 1000,
    });
    const zoneA = makeZone();
    return {
      speed: Math.round((0.52 + difficulty * 0.11) * 100) / 100,
      startPos: Math.round(rng.float(0, 1) * 100) / 100,
      direction: rng.bool() ? 1 : -1,
      zones: { A: zoneA, B: mode === 'coop' ? makeZone() : zoneA },
      blindfolded: mode === 'coop',
    };
  },

  viewFor(payload, slot, mode): StopTheBarView {
    const own = payload.zones[slot];
    const partner = payload.zones[slot === 'A' ? 'B' : 'A'];
    const blind = payload.blindfolded && mode === 'coop';
    return {
      speed: payload.speed,
      startPos: payload.startPos,
      direction: payload.direction,
      ownZone: blind ? null : own,
      partnerZone: blind ? partner : null,
      blindfolded: blind,
    };
  },

  solutionFor(payload, slot) {
    return payload.zones[slot];
  },

  isValidAnswer(answer): answer is StopTheBarAnswer {
    return (
      typeof answer === 'object' &&
      answer !== null &&
      typeof (answer as StopTheBarAnswer).elapsedMs === 'number' &&
      Number.isFinite((answer as StopTheBarAnswer).elapsedMs) &&
      (answer as StopTheBarAnswer).elapsedMs >= 0
    );
  },

  evaluate(payload, answer, slot, _mode, context) {
    // The client reports *when* it stopped, never *where*. The server replays the
    // motion itself and refuses timestamps that drift beyond the latency window.
    const tolerance = 400;
    const elapsed =
      Math.abs(answer.elapsedMs - context.elapsedMs) > tolerance
        ? context.elapsedMs
        : answer.elapsedMs;
    const clamped = Math.max(0, Math.min(context.durationMs, elapsed));
    const position = barPositionAt(payload, clamped);
    const zone = payload.zones[slot];
    const distance = Math.abs(position - zone.center);
    const half = zone.width / 2;
    if (distance > half) return { correct: false, accuracy: 0 };
    const precision = 1 - distance / half;
    return { correct: true, accuracy: 0.6 + 0.4 * precision };
  },
};
