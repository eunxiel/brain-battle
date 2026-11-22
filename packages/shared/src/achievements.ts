import type { GameMode, PlayerProfile } from './types.js';

export interface AchievementContext {
  profile: PlayerProfile;
  mode: GameMode;
  matchScore: number;
  correct: number;
  wrong: number;
  bestStreak: number;
  avgResponseMs: number;
  livesLeft: number;
  won: boolean;
  teamVictory: boolean | null;
  perfectRounds: boolean;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold';
  check: (ctx: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-blood',
    title: 'First Steps',
    description: 'Finish your first match.',
    icon: 'flag',
    tier: 'bronze',
    check: (c) => c.profile.totalMatches >= 1,
  },
  {
    id: 'first-win',
    title: 'Winner Winner',
    description: 'Win your first Versus match.',
    icon: 'trophy',
    tier: 'bronze',
    check: (c) => c.mode === 'versus' && c.won,
  },
  {
    id: 'flawless',
    title: 'Flawless Mind',
    description: 'Finish a match without losing a single life.',
    icon: 'heart',
    tier: 'gold',
    check: (c) => c.livesLeft === 3 && c.correct + c.wrong >= 12,
  },
  {
    id: 'streak-6',
    title: 'On Fire',
    description: 'Hit a streak of 6 correct answers.',
    icon: 'flame',
    tier: 'silver',
    check: (c) => c.bestStreak >= 6,
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Average under 1.6s response time in a match.',
    icon: 'bolt',
    tier: 'silver',
    check: (c) => c.avgResponseMs > 0 && c.avgResponseMs < 1600 && c.correct >= 6,
  },
  {
    id: 'score-2000',
    title: 'Big Brain',
    description: 'Score 2,000 points in a single match.',
    icon: 'brain',
    tier: 'silver',
    check: (c) => c.matchScore >= 2000,
  },
  {
    id: 'score-3500',
    title: 'Galaxy Brain',
    description: 'Score 3,500 points in a single match.',
    icon: 'star',
    tier: 'gold',
    check: (c) => c.matchScore >= 3500,
  },
  {
    id: 'team-player',
    title: 'Team Player',
    description: 'Clear all 12 rounds in Co-op.',
    icon: 'handshake',
    tier: 'gold',
    check: (c) => c.mode === 'coop' && c.teamVictory === true,
  },
  {
    id: 'veteran-10',
    title: 'Regular',
    description: 'Play 10 matches.',
    icon: 'medal',
    tier: 'bronze',
    check: (c) => c.profile.totalMatches >= 10,
  },
  {
    id: 'level-5',
    title: 'Rising Star',
    description: 'Reach level 5.',
    icon: 'rocket',
    tier: 'silver',
    check: (c) => c.profile.level >= 5,
  },
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function evaluateAchievements(ctx: AchievementContext): string[] {
  const owned = new Set(ctx.profile.achievements);
  return ACHIEVEMENTS.filter((a) => !owned.has(a.id) && a.check(ctx)).map((a) => a.id);
}
