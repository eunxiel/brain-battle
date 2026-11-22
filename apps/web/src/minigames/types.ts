import type { ComponentType } from 'react';
import type { GameMode } from '@brain-battle/shared';
import type { AccentTheme } from '../design/tokens';

export interface MiniGameProps<TView = unknown> {
  /** The masked payload for this seat, straight from the server. */
  view: TView;
  /**
   * Submits an answer. The first call wins; later calls are ignored.
   * `elapsedOverride` exists for precision games that measure their own timing.
   */
  submit: (answer: unknown, elapsedOverride?: number) => void;
  /** Milliseconds since the round opened, on the server clock. */
  elapsed: number;
  remaining: number;
  durationMs: number;
  mode: GameMode;
  /** True once an answer was sent or the round closed. */
  locked: boolean;
  accent: AccentTheme;
}

export type MiniGameComponent = ComponentType<MiniGameProps<never>>;
