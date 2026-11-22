import type { AccentKey } from '@brain-battle/shared';

export interface AccentTheme {
  /** Tailwind-ready class fragments so components stay declarative. */
  text: string;
  bg: string;
  bgSoft: string;
  border: string;
  ring: string;
  /** Raw hex for canvas / inline SVG work. */
  hex: string;
  deep: string;
  soft: string;
}

export const ACCENTS: Record<AccentKey, AccentTheme> = {
  violet: {
    text: 'text-violet',
    bg: 'bg-violet',
    bgSoft: 'bg-violet-soft',
    border: 'border-violet',
    ring: 'ring-violet',
    hex: '#7C5CFF',
    deep: '#5B3FD6',
    soft: '#EBE4FF',
  },
  coral: {
    text: 'text-coral',
    bg: 'bg-coral',
    bgSoft: 'bg-coral-soft',
    border: 'border-coral',
    ring: 'ring-coral',
    hex: '#FF5F7E',
    deep: '#DE3F60',
    soft: '#FFE6EC',
  },
  mint: {
    text: 'text-mint',
    bg: 'bg-mint',
    bgSoft: 'bg-mint-soft',
    border: 'border-mint',
    ring: 'ring-mint',
    hex: '#19D2A4',
    deep: '#0FAA84',
    soft: '#D9FBF1',
  },
  sun: {
    text: 'text-sun',
    bg: 'bg-sun',
    bgSoft: 'bg-sun-soft',
    border: 'border-sun',
    ring: 'ring-sun',
    hex: '#FFC43D',
    deep: '#E0A111',
    soft: '#FFF3D6',
  },
  sky: {
    text: 'text-sky',
    bg: 'bg-sky',
    bgSoft: 'bg-sky-soft',
    border: 'border-sky',
    ring: 'ring-sky',
    hex: '#39B7FF',
    deep: '#1B90D6',
    soft: '#DDF1FF',
  },
};

export const accentOf = (key: string | undefined): AccentTheme =>
  ACCENTS[(key as AccentKey) ?? 'violet'] ?? ACCENTS.violet;

/** Slot colours keep "you vs them" readable at a glance across every screen. */
export const SLOT_ACCENT = { A: ACCENTS.violet, B: ACCENTS.coral } as const;
