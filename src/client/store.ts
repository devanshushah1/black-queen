'use client';
import { create } from 'zustand';
import type { Room, Player } from '@/shared/types';

export interface GameStore {
  /** Server-issued session id for this browser tab in the current room. */
  sessionId: string | null;
  /** Current room state as last broadcast from the server. */
  room: Room | null;
  /** True once the socket is connected. */
  connected: boolean;

  setSession(sessionId: string): void;
  setRoom(room: Room | null): void;
  setConnected(c: boolean): void;
  reset(): void;
}

export const useGameStore = create<GameStore>((set) => ({
  sessionId: null,
  room: null,
  connected: false,
  setSession: (sessionId) => set({ sessionId }),
  setRoom: (room) => set({ room }),
  setConnected: (connected) => set({ connected }),
  reset: () => set({ sessionId: null, room: null }),
}));

/** Convenience selectors */
export function selectMe(state: GameStore): Player | null {
  if (!state.room || !state.sessionId) return null;
  return state.room.players.find((p) => p.id === state.sessionId) ?? null;
}
