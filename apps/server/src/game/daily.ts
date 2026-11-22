import { buildRoundPlan, createRng, type MiniGameId } from '@brain-battle/shared';

/** Everyone in the world gets the same Daily Challenge line-up. */
export function dailyPlan(dateKey: string): MiniGameId[] {
  return buildRoundPlan(createRng(`daily:${dateKey}`));
}
