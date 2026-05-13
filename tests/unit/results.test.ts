import { describe, it, expect } from 'vitest';
import { computeResults } from '@/shared/results';
import type { PublicGameState, Card, Suit } from '@/shared/types';

const c = (suit: Suit, rank: any): Card => ({ suit, rank });

function makeGame(partial: Partial<PublicGameState['bid']> & { trumpPartner: any; revealedPartnerSeat: any; completedTricks: any[] }): PublicGameState {
  return {
    bid: {
      currentBid: 95,
      currentBidderSeat: 1,
      passedSeats: [2, 3, 4],
      complete: true,
      ...partial,
    },
    trumpPartner: partial.trumpPartner,
    currentTrick: null,
    completedTricks: partial.completedTricks,
    revealedPartnerSeat: partial.revealedPartnerSeat,
  };
}

describe('computeResults', () => {
  it('returns null when game is incomplete', () => {
    const game = makeGame({
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: null,
      completedTricks: [],
    });
    expect(computeResults(game)).toBeNull();
  });

  it('returns null when trumpPartner is missing', () => {
    const game: PublicGameState = {
      bid: { currentBid: null, currentBidderSeat: null, passedSeats: [], complete: false },
      trumpPartner: null,
      currentTrick: null,
      completedTricks: [],
      revealedPartnerSeat: null,
    };
    expect(computeResults(game)).toBeNull();
  });

  it('sums point cards into the winning seat per trick', () => {
    const game = makeGame({
      currentBid: 100,
      currentBidderSeat: 1,
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: 2,
      completedTricks: [
        // Trick 1: Ace of hearts (15) + Q of spades (30) captured by seat 2
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('hearts', 'K') },     // 0
          { seat: 2, card: c('spades', '2') },     // trump, 0
          { seat: 3, card: c('hearts', 'A') },     // 15
          { seat: 4, card: c('spades', 'Q') },     // QoS, 30
        ], winnerSeat: 4 }, // seat 4 wins (Q spades > 2 spades)
      ],
    });
    const r = computeResults(game);
    expect(r).not.toBeNull();
    if (!r) return;
    // Seat 4 captured Ace of hearts (15) + QoS (30) + K hearts (0) + 2 spades (0) = 45
    expect(r.pointsBySeat[4]).toBe(45);
    expect(r.pointsBySeat[1]).toBe(0);
    expect(r.pointsBySeat[2]).toBe(0);
    expect(r.pointsBySeat[3]).toBe(0);
  });

  it('groups bidder + partner into bidder team, sums totals', () => {
    const game = makeGame({
      currentBid: 100,
      currentBidderSeat: 1,
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: 3,
      completedTricks: [
        // Seat 1 wins 15 points
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('hearts', 'A') },
          { seat: 2, card: c('hearts', '2') },
          { seat: 3, card: c('hearts', '3') },
          { seat: 4, card: c('hearts', '4') },
        ], winnerSeat: 1 },
        // Seat 3 (partner) wins 10 points
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('clubs', '2') },
          { seat: 2, card: c('clubs', '3') },
          { seat: 3, card: c('clubs', '10') },
          { seat: 4, card: c('clubs', '4') },
        ], winnerSeat: 3 },
        // Seat 2 (other) wins 5 points
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('diamonds', '2') },
          { seat: 2, card: c('diamonds', '5') },
          { seat: 3, card: c('diamonds', '3') },
          { seat: 4, card: c('diamonds', '4') },
        ], winnerSeat: 2 },
      ],
    });
    const r = computeResults(game);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.bidderTeamPoints).toBe(25); // 15 + 10
    expect(r.otherTeamPoints).toBe(5);
    expect(r.bidderTeamWon).toBe(false); // 25 < 100
  });

  it('marks bidder team as won when total ≥ bid', () => {
    const game = makeGame({
      currentBid: 15,
      currentBidderSeat: 1,
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: 3,
      completedTricks: [
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('hearts', 'A') },
          { seat: 2, card: c('hearts', '2') },
          { seat: 3, card: c('hearts', '3') },
          { seat: 4, card: c('hearts', '4') },
        ], winnerSeat: 1 },
      ],
    });
    const r = computeResults(game);
    expect(r?.bidderTeamWon).toBe(true);
  });

  it('captures the played cards into capturedBySeat', () => {
    const game = makeGame({
      currentBid: 95,
      currentBidderSeat: 1,
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: 3,
      completedTricks: [
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('hearts', 'A') },
          { seat: 2, card: c('hearts', '2') },
          { seat: 3, card: c('hearts', '3') },
          { seat: 4, card: c('hearts', '4') },
        ], winnerSeat: 1 },
      ],
    });
    const r = computeResults(game);
    expect(r?.capturedBySeat[1].map((card) => `${card.rank}${card.suit[0]}`)).toEqual(['Ah', '2h', '3h', '4h']);
    expect(r?.capturedBySeat[2]).toEqual([]);
  });
});
