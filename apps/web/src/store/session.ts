import { create } from 'zustand';
import type {
  Ack,
  DailyChallengeState,
  HelloResult,
  MatchHistoryEntry,
  PlayerProfile,
  ProfileBundle,
} from '@brain-battle/shared';
import { request, serverClock, socket } from '../net/socket';

const ID_KEY = 'bb.playerId';
const TOKEN_KEY = 'bb.token';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

interface SessionState {
  status: ConnectionStatus;
  profile: PlayerProfile | null;
  history: MatchHistoryEntry[];
  daily: DailyChallengeState | null;
  error: string | null;
  setStatus: (status: ConnectionStatus) => void;
  setProfile: (profile: PlayerProfile) => void;
  hello: () => Promise<void>;
  refreshBundle: () => Promise<void>;
  saveProfile: (patch: { username: string; avatarId: string }) => Promise<boolean>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'connecting',
  profile: null,
  history: [],
  daily: null,
  error: null,

  setStatus: (status) => set({ status }),
  setProfile: (profile) => set({ profile }),

  hello: async () => {
    // A throw in here must never leave the app on the boot screen forever.
    let res: Ack<HelloResult>;
    try {
      res = await request<HelloResult>('session:hello', {
        playerId: localStorage.getItem(ID_KEY),
        token: localStorage.getItem(TOKEN_KEY),
      });
    } catch (error) {
      set({ status: 'offline', error: (error as Error).message });
      return;
    }
    if (!res.ok) {
      set({ status: 'offline', error: res.message });
      return;
    }
    localStorage.setItem(ID_KEY, res.data.profile.id);
    localStorage.setItem(TOKEN_KEY, res.data.token);
    set({ profile: res.data.profile, status: 'online', error: null });
    void serverClock.sync();
    void get().refreshBundle();
  },

  refreshBundle: async () => {
    const res = await request<ProfileBundle>('session:bundle');
    if (!res.ok) return;
    set({
      profile: res.data.profile,
      history: res.data.history,
      daily: res.data.daily,
    });
  },

  saveProfile: async (patch) => {
    const res = await request<PlayerProfile>('session:profile', patch);
    if (!res.ok) return false;
    set({ profile: res.data });
    return true;
  },
}));

/** Lightweight selector used all over the UI. */
export const useMyId = (): string | null => useSessionStore((s) => s.profile?.id ?? null);

socket.on('profile:update', (profile) => useSessionStore.getState().setProfile(profile));
