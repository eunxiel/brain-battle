import type { MiniGameId } from '@brain-battle/shared';
import { BiggerNumberGame } from './BiggerNumberGame';
import { MemoryGridGame } from './MemoryGridGame';
import { OddOneOutGame } from './OddOneOutGame';
import { SequenceGame } from './SequenceGame';
import { StopTheBarGame } from './StopTheBarGame';
import type { MiniGameComponent } from './types';

/**
 * Renderer registry. A new mini-game needs one definition in
 * `packages/shared/src/minigames` and one component here — nothing else.
 */
export const MINI_GAME_RENDERERS: Record<MiniGameId, MiniGameComponent> = {
  'memory-grid': MemoryGridGame as MiniGameComponent,
  'bigger-number': BiggerNumberGame as MiniGameComponent,
  'odd-one-out': OddOneOutGame as MiniGameComponent,
  'stop-the-bar': StopTheBarGame as MiniGameComponent,
  sequence: SequenceGame as MiniGameComponent,
};

export type { MiniGameProps } from './types';
