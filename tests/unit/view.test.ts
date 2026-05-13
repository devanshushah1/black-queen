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
    { id: 'h1', name: 'Dev', seat: 1, connected: true, disconnectedAt: null },
    { id: 'p2', name: 'Sam', seat: 2, connected: true, disconnectedAt: null },
    { id: 'p3', name: 'Riya', seat: 3, connected: true, disconnectedAt: null },
    { id: 'p4', name: 'Aman', seat: 4, connected: true, disconnectedAt: null },
  ],
  chat: [],
  createdAt: 1,
  game: {
    bid: { currentBid: 90, currentBidderSeat: 1, passedSeats: [2], complete: false },
    trumpPartner: null,
    currentTrick: null,
    completedTricks: [],
    partnerSeat: null,
    revealedPartnerSeat: null,
  },
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

  it('strips partnerSeat from game when game is set', () => {
    const state: RoomServerState = {
      code: 'ABCD',
      hostId: 'h1',
      phase: 'play',
      players: [],
      chat: [],
      createdAt: 1,
      hands: null,
      game: {
        bid: { currentBid: 90, currentBidderSeat: 1, passedSeats: [2, 3, 4], complete: true },
        trumpPartner: { trump: 'spades', calledCard: { suit: 'hearts', rank: 'A' } },
        currentTrick: null,
        completedTricks: [],
        partnerSeat: 2,
        revealedPartnerSeat: null,
      },
    };
    const view = toRoomView(state);
    expect(view.game).not.toBeNull();
    expect('partnerSeat' in (view.game ?? {})).toBe(false);
    expect(view.game?.revealedPartnerSeat).toBeNull();
  });
});
