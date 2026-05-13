import { describe, it, expect } from 'vitest';
import { validateTrumpPartnerChoice } from '@/server/game/trump-partner';
import type { Card } from '@/shared/types';

const aceHearts: Card = { suit: 'hearts', rank: 'A' };
const fiveClubs: Card = { suit: 'clubs', rank: '5' };

const sampleHands = {
  1: [{ suit: 'spades' as const, rank: 'K' as const }, { suit: 'hearts' as const, rank: '2' as const }],
  2: [aceHearts],
  3: [fiveClubs],
  4: [{ suit: 'diamonds' as const, rank: '9' as const }],
};

describe('validateTrumpPartnerChoice', () => {
  it('accepts a card the bidder does not hold', () => {
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1, hands: sampleHands, trump: 'spades', calledCard: aceHearts,
    });
    expect(res.ok).toBe(true);
  });

  it('rejects calling a card the bidder holds (OWN_CARD)', () => {
    const ownCard: Card = { suit: 'hearts', rank: '2' };
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1, hands: sampleHands, trump: 'spades', calledCard: ownCard,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('OWN_CARD');
  });

  it('rejects an invalid card (rank/suit outside the deck)', () => {
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1, hands: sampleHands, trump: 'spades',
      calledCard: { suit: 'hearts', rank: '1' as any },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_CARD');
  });

  it('finds the partner seat that holds the called card', () => {
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1, hands: sampleHands, trump: 'spades', calledCard: fiveClubs,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.partnerSeat).toBe(3);
  });

  it('rejects if no seat holds the called card', () => {
    const phantomCard: Card = { suit: 'hearts', rank: '7' };
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1, hands: sampleHands, trump: 'spades', calledCard: phantomCard,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_CARD');
  });
});
