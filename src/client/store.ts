'use client';
import { create } from 'zustand';
import type { RoomView, Player, Card } from '@/shared/types';

export interface GameStore {
  sessionId: string | null;
  room: RoomView | null;
  yourHand: Card[];
  connected: boolean;

  setSession(sessionId: string): void;
  setRoom(room: RoomView | null): void;
  setHand(hand: Card[]): void;
  setConnected(c: boolean): void;
  reset(): void;
}

export const useGameStore = create<GameStore>((set) => ({
  sessionId: null,
  room: null,
  yourHand: [],
  connected: false,
  setSession: (sessionId) => set({ sessionId }),
  setRoom: (room) => set({ room }),
  setHand: (yourHand) => set({ yourHand }),
  setConnected: (connected) => set({ connected }),
  reset: () => set({ sessionId: null, room: null, yourHand: [] }),
}));

export function selectMe(state: GameStore): Player | null {
  if (!state.room || !state.sessionId) return null;
  return state.room.players.find((p) => p.id === state.sessionId) ?? null;
}
