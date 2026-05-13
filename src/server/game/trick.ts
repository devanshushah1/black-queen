import {
  type Card,
  type CurrentTrick,
  type Seat,
  type Suit,
  type PlayCardResult,
} from '@/shared/types';

export function startTrick(ledBy: Seat): CurrentTrick {
  return { ledBy, ledSuit: null, plays: [] };
}

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

export function isLegalPlay(trick: CurrentTrick, hand: Card[], play: Card): boolean {
  if (trick.ledSuit === null) return true;
  const hasLedSuit = hand.some((c) => c.suit === trick.ledSuit);
  if (!hasLedSuit) return true;
  return play.suit === trick.ledSuit;
}

export interface PlayResult {
  ok: true;
  trick: CurrentTrick;
  complete: boolean;
}

export function playCardInTrick(
  trick: CurrentTrick,
  seat: Seat,
  card: Card,
): PlayResult | { ok: false; error: PlayCardResult extends { ok: false; error: infer E } ? E : never } {
  const plays = [...trick.plays, { seat, card }];
  const ledSuit = trick.ledSuit ?? card.suit;
  return {
    ok: true,
    trick: { ledBy: trick.ledBy, ledSuit, plays },
    complete: plays.length === 4,
  };
}

export function resolveTrick(trick: CurrentTrick, trump: Suit): Seat {
  if (trick.plays.length !== 4 || trick.ledSuit === null) {
    throw new Error('resolveTrick: trick is not complete');
  }
  const trumpPlays = trick.plays.filter((p) => p.card.suit === trump);
  const candidates = trumpPlays.length > 0
    ? trumpPlays
    : trick.plays.filter((p) => p.card.suit === trick.ledSuit);
  let best = candidates[0];
  for (const p of candidates) {
    if (RANK_VALUE[p.card.rank] > RANK_VALUE[best.card.rank]) best = p;
  }
  return best.seat;
}
