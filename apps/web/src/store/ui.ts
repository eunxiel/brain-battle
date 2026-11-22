import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface UiState {
  toasts: Toast[];
  soundEnabled: boolean;
  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;
  toggleSound: () => void;
}

const SOUND_KEY = 'bb.sound';
let nextId = 1;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  soundEnabled: localStorage.getItem(SOUND_KEY) !== 'off',

  pushToast: (kind, message) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-2), { id, kind, message }] });
    setTimeout(() => get().dismissToast(id), 4200);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  toggleSound: () => {
    const next = !get().soundEnabled;
    localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
    set({ soundEnabled: next });
  },
}));

export const toast = (kind: ToastKind, message: string): void =>
  useUiStore.getState().pushToast(kind, message);
