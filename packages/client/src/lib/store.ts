import type { Board, GameView, Rules } from '@lw/engine';
import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

export interface LobbySeat {
  seat: number;
  userId: number | string | null;
  name: string;
  bot: boolean;
}

export interface RoomConfig {
  playerCount: number;
  board: Board;
  rules: Rules;
  roleConfig: Record<string, Record<string, any>>;
  presetName: string;
}

export interface LobbyState {
  code: string;
  hostId: number;
  hostName: string;
  config: RoomConfig;
  seats: LobbySeat[];
  started: boolean;
  over: boolean;
  gameId: number | null;
  serverVoice: boolean;
  voiceMode: 'host' | 'server';
  speaker: { socketId: string; display: boolean } | null;
}

export interface GamePacket {
  view: GameView;
  seat: number | null;
  display: boolean;
  isHost: boolean;
}

export interface Toast {
  id: number;
  type: 'error' | 'info' | 'success';
  text: string;
}

interface Store {
  user: User | null;
  userLoaded: boolean;
  connected: boolean;
  lobby: LobbyState | null;
  game: GamePacket | null;
  toasts: Toast[];
  clockOffset: number;
  /** 本设备是否已解锁音频播放 */
  voiceUnlocked: boolean;
  setUser(u: User | null): void;
  toast(text: string, type?: Toast['type']): void;
  dismiss(id: number): void;
}

let toastId = 0;

export const useStore = create<Store>((set) => ({
  user: null,
  userLoaded: false,
  connected: false,
  lobby: null,
  game: null,
  toasts: [],
  clockOffset: 0,
  voiceUnlocked: false,
  setUser: (u) => set({ user: u, userLoaded: true }),
  toast: (text, type = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, type, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const serverNow = () => Date.now() + useStore.getState().clockOffset;
