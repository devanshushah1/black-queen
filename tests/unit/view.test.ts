import { describe, it, expect } from 'vitest';
import { toRoomView } from '@/server/game/view';
import type { RoomServerState, Card } from '@/shared/types';

const aceHearts: Card = { suit: 'hearts', rank: 'A' };
const fiveClubs: Card = { suit: 'clubs', rank: '5' };

const sampleServerState: RoomServerState = {
  code: 'ABCD',
  hostId: 'h1',
  phase: 'bidding',
  players: [
    { id: 'h1', name: 'Dev', seat: 1, connected: true },
    { id: 'p2', name: 'Sam', seat: 2, connected: true },
    { id: 'p3', name: 'Riya', seat: 3, connected: true },
    { id: 'p4', name: 'Aman', seat: 4, connected: true },
  ],
  chat: [],
  createdAt: 1,
  game: { bid: { currentBid: 90, currentBidderSeat: 1, passedSeats: [2], complete: false } },
  hands: {
    1: [aceHearts],
    2: [fiveClubs],
    3: [],
    4: [],
  },
};

describe('toRoomView', () => {
  it('strips the hands field from the server state', () => {
    const view = toRoomView(sampleServerState);
    expect('hands' in view).toBe(false);
  });

  it('preserves all public fields (code, hostId, phase, players, chat, createdAt, game)', () => {
    const view = toRoomView(sampleServerState);
    expect(view.code).toBe('ABCD');
    expect(view.hostId).toBe('h1');
    expect(view.phase).toBe('bidding');
    expect(view.players).toHaveLength(4);
    expect(view.chat).toEqual([]);
    expect(view.createdAt).toBe(1);
    expect(view.game?.bid.currentBid).toBe(90);
  });
});
