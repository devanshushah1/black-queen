'use client';
import { create } from 'zustand';
import type { RoomView, Player, Card } from '@/shared/types';

const MUTED_KEY = 'bq:muted';

function loadMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export interface GameStore {
  sessionId: string | null;
  room: RoomView | null;
  yourHand: Card[];
  connected: boolean;
  muted: boolean;

  setSession(sessionId: string): void;
  setRoom(room: RoomView | null): void;
  setHand(hand: Card[]): void;
  setConnected(c: boolean): void;
  setMuted(muted: boolean): void;
  reset(): void;
}

export const useGameStore = create<GameStore>((set) => ({
  sessionId: null,
  room: null,
  yourHand: [],
  connected: false,
  muted: loadMuted(),
  setSession: (sessionId) => set({ sessionId }),
  setRoom: (room) => set({ room }),
  setHand: (yourHand) => set({ yourHand }),
  setConnected: (connected) => set({ connected }),
  setMuted: (muted) => {
    saveMuted(muted);
    set({ muted });
  },
  reset: () => set({ sessionId: null, room: null, yourHand: [] }),
}));

export function selectMe(state: GameStore): Player | null {
  if (!state.room || !state.sessionId) return null;
  return state.room.players.find((p) => p.id === state.sessionId) ?? null;
}
