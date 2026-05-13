import {
  type Card,
  type Suit,
  type Seat,
  RANKS,
  SUITS,
  cardKey,
} from '@/shared/types';

export interface ValidateInput {
  bidderSeat: Seat;
  hands: Record<Seat, Card[]>;
  trump: Suit;
  calledCard: Card;
}

export type ValidateOutput =
  | { ok: true; partnerSeat: Seat }
  | { ok: false; error: 'INVALID_CARD' | 'OWN_CARD' };

function isLegalCard(card: Card): boolean {
  return SUITS.includes(card.suit) && RANKS.includes(card.rank);
}

export function validateTrumpPartnerChoice(input: ValidateInput): ValidateOutput {
  if (!isLegalCard(input.calledCard)) return { ok: false, error: 'INVALID_CARD' };
  const key = cardKey(input.calledCard);
  let owner: Seat | null = null;
  for (const seat of [1, 2, 3, 4] as Seat[]) {
    if (input.hands[seat].some((c) => cardKey(c) === key)) {
      owner = seat;
      break;
    }
  }
  if (owner === null) return { ok: false, error: 'INVALID_CARD' };
  if (owner === input.bidderSeat) return { ok: false, error: 'OWN_CARD' };
  return { ok: true, partnerSeat: owner };
}
