/**
 * Profile avatars (not playable characters).
 * Each is drawn as a geometric mascot from these tokens — no image assets.
 */
export type AvatarFace = 'spark' | 'bolt' | 'owl' | 'cat' | 'robot' | 'alien' | 'bear' | 'ghost';

export interface AvatarDef {
  id: string;
  name: string;
  from: string;
  to: string;
  face: AvatarFace;
  accent: string;
}

export const AVATARS: AvatarDef[] = [
  { id: 'nova', name: 'Nova', from: '#8B5CF6', to: '#6366F1', face: 'spark', accent: '#FDE68A' },
  { id: 'blaze', name: 'Blaze', from: '#FB7185', to: '#F43F5E', face: 'bolt', accent: '#FFE4E6' },
  { id: 'sage', name: 'Sage', from: '#34D399', to: '#10B981', face: 'owl', accent: '#D1FAE5' },
  { id: 'mochi', name: 'Mochi', from: '#FBBF24', to: '#F59E0B', face: 'cat', accent: '#FFFBEB' },
  { id: 'byte', name: 'Byte', from: '#38BDF8', to: '#0EA5E9', face: 'robot', accent: '#E0F2FE' },
  { id: 'zeph', name: 'Zeph', from: '#A78BFA', to: '#7C3AED', face: 'alien', accent: '#EDE9FE' },
  { id: 'bruno', name: 'Bruno', from: '#F97316', to: '#EA580C', face: 'bear', accent: '#FFEDD5' },
  { id: 'wisp', name: 'Wisp', from: '#22D3EE', to: '#06B6D4', face: 'ghost', accent: '#CFFAFE' },
  { id: 'pixel', name: 'Pixel', from: '#EC4899', to: '#DB2777', face: 'robot', accent: '#FCE7F3' },
  { id: 'kiwi', name: 'Kiwi', from: '#84CC16', to: '#65A30D', face: 'cat', accent: '#ECFCCB' },
  { id: 'luna', name: 'Luna', from: '#60A5FA', to: '#3B82F6', face: 'owl', accent: '#DBEAFE' },
  { id: 'coco', name: 'Coco', from: '#F472B6', to: '#E879F9', face: 'spark', accent: '#FAE8FF' },
];

export const DEFAULT_AVATAR_ID = 'nova';

export function getAvatar(id: string | undefined | null): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? (AVATARS[0] as AvatarDef);
}

const NAME_PARTS_A = [
  'Quick', 'Turbo', 'Mega', 'Hyper', 'Clever', 'Swift', 'Brainy', 'Sharp', 'Lucky', 'Cosmic',
];
const NAME_PARTS_B = [
  'Fox', 'Owl', 'Comet', 'Tiger', 'Wizard', 'Panda', 'Falcon', 'Otter', 'Dragon', 'Koala',
];

export function randomUsername(): string {
  const a = NAME_PARTS_A[Math.floor(Math.random() * NAME_PARTS_A.length)];
  const b = NAME_PARTS_B[Math.floor(Math.random() * NAME_PARTS_B.length)];
  return `${a}${b}${Math.floor(Math.random() * 90 + 10)}`;
}
