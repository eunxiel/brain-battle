import { useUiStore } from '../store/ui';

/**
 * Tiny WebAudio synth — no audio assets to download, no licensing, and every
 * cue stays under a few milliseconds of main-thread work.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOptions {
  freq: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

function tone({ freq, duration = 0.12, type = 'sine', gain = 0.12, delay = 0, slideTo }: ToneOptions): void {
  const context = audio();
  if (!context) return;
  const start = context.currentTime + delay;
  const osc = context.createOscillator();
  const amp = context.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), start + duration);

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp).connect(context.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

type Cue =
  | 'click'
  | 'pop'
  | 'correct'
  | 'wrong'
  | 'tick'
  | 'countdown'
  | 'start'
  | 'win'
  | 'lose'
  | 'reveal'
  | 'streak';

export function play(cue: Cue): void {
  if (!useUiStore.getState().soundEnabled) return;
  switch (cue) {
    case 'click':
      tone({ freq: 520, duration: 0.07, type: 'triangle', gain: 0.07 });
      break;
    case 'pop':
      tone({ freq: 760, duration: 0.09, type: 'sine', gain: 0.1, slideTo: 1040 });
      break;
    case 'reveal':
      tone({ freq: 640, duration: 0.1, type: 'triangle', gain: 0.08 });
      break;
    case 'correct':
      tone({ freq: 660, duration: 0.1, type: 'sine', gain: 0.11 });
      tone({ freq: 880, duration: 0.14, type: 'sine', gain: 0.11, delay: 0.09 });
      break;
    case 'streak':
      [660, 830, 990, 1240].forEach((freq, i) =>
        tone({ freq, duration: 0.09, type: 'triangle', gain: 0.09, delay: i * 0.06 }),
      );
      break;
    case 'wrong':
      tone({ freq: 240, duration: 0.22, type: 'sawtooth', gain: 0.08, slideTo: 120 });
      break;
    case 'tick':
      tone({ freq: 1200, duration: 0.04, type: 'square', gain: 0.045 });
      break;
    case 'countdown':
      tone({ freq: 440, duration: 0.12, type: 'triangle', gain: 0.1 });
      break;
    case 'start':
      [523, 659, 784].forEach((freq, i) =>
        tone({ freq, duration: 0.16, type: 'triangle', gain: 0.1, delay: i * 0.09 }),
      );
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((freq, i) =>
        tone({ freq, duration: 0.22, type: 'triangle', gain: 0.12, delay: i * 0.12 }),
      );
      break;
    case 'lose':
      [440, 392, 311].forEach((freq, i) =>
        tone({ freq, duration: 0.26, type: 'sine', gain: 0.1, delay: i * 0.16 }),
      );
      break;
  }
}
