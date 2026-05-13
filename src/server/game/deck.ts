import {
  type Card,
  SUITS,
  RANKS,
  pointValue,
} from '@/shared/types';

/** Returns a fresh, unshuffled 52-card deck in stable suit-major order. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle. Returns a NEW array; does not mutate input.
 *
 * @param rng optional random source (defaults to Math.random) — injecting an rng
 *            lets tests be deterministic.
 */
export function shuffle(deck: Card[], rng: () => number = Math.random): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type SeatHands = Record<1 | 2 | 3 | 4, Card[]>;

/** Deals 13 cards to each of seats 1-4 in round-robin order. */
export function deal(deck: Card[]): SeatHands {
  if (deck.length !== 52) {
    throw new Error(`Cannot deal: expected 52 cards, got ${deck.length}`);
  }
  const hands: SeatHands = { 1: [], 2: [], 3: [], 4: [] };
  for (let i = 0; i < deck.length; i++) {
    const seat = ((i % 4) + 1) as 1 | 2 | 3 | 4;
    hands[seat].push(deck[i]);
  }
  return hands;
}

/** Sum of point values in a card collection. */
export function totalPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + pointValue(c), 0);
}
