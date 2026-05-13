import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, deal, totalPoints } from '@/server/game/deck';
import { SUITS, RANKS, pointValue, cardKey } from '@/shared/types';

describe('createDeck', () => {
  it('returns 52 unique cards (4 suits × 13 ranks)', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const keys = new Set(deck.map(cardKey));
    expect(keys.size).toBe(52);
  });

  it('contains every (suit, rank) combination', () => {
    const deck = createDeck();
    const keys = new Set(deck.map(cardKey));
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        expect(keys.has(`${rank}-${suit}`)).toBe(true);
      }
    }
  });
});

describe('shuffle', () => {
  it('returns 52 cards (no duplicates, no losses)', () => {
    const shuffled = shuffle(createDeck());
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map(cardKey)).size).toBe(52);
  });

  it('produces different orderings with different seeds', () => {
    const a = shuffle(createDeck(), () => 0.1);
    const b = shuffle(createDeck(), () => 0.9);
    const aKey = a.map(cardKey).join(',');
    const bKey = b.map(cardKey).join(',');
    expect(aKey).not.toBe(bKey);
  });

  it('is deterministic with the same rng', () => {
    const rng = () => 0.5;
    const a = shuffle(createDeck(), rng);
    const b = shuffle(createDeck(), rng);
    expect(a.map(cardKey)).toEqual(b.map(cardKey));
  });
});

describe('deal', () => {
  it('deals 13 cards to each of 4 seats', () => {
    const hands = deal(createDeck());
    expect(Object.keys(hands).sort()).toEqual(['1', '2', '3', '4']);
    for (const seat of [1, 2, 3, 4] as const) {
      expect(hands[seat]).toHaveLength(13);
    }
  });

  it('deals all 52 cards across the 4 hands with no overlap', () => {
    const hands = deal(createDeck());
    const all = [...hands[1], ...hands[2], ...hands[3], ...hands[4]];
    expect(all).toHaveLength(52);
    expect(new Set(all.map(cardKey)).size).toBe(52);
  });

  it('throws if given a deck without 52 cards', () => {
    expect(() => deal([])).toThrow(/expected 52/i);
    expect(() => deal(createDeck().slice(0, 50))).toThrow(/expected 52/i);
  });
});

describe('totalPoints', () => {
  it('a full deck totals 150 points', () => {
    expect(totalPoints(createDeck())).toBe(150);
  });

  it('a single 5 is 5, a single 10 is 10, a single Ace is 15, Q♠ is 30', () => {
    expect(pointValue({ suit: 'hearts', rank: '5' })).toBe(5);
    expect(pointValue({ suit: 'clubs', rank: '10' })).toBe(10);
    expect(pointValue({ suit: 'diamonds', rank: 'A' })).toBe(15);
    expect(pointValue({ suit: 'spades', rank: 'Q' })).toBe(30);
    expect(pointValue({ suit: 'hearts', rank: 'Q' })).toBe(0);
    expect(pointValue({ suit: 'spades', rank: '7' })).toBe(0);
  });
});
