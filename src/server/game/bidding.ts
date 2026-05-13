import {
  type BidState,
  type Seat,
  type BidActionResult,
  MIN_BID,
  MAX_BID,
  BID_INCREMENT,
} from '@/shared/types';

export function emptyBidState(): BidState {
  return { currentBid: null, currentBidderSeat: null, passedSeats: [], complete: false };
}

function isValidAmount(amount: number): boolean {
  if (!Number.isInteger(amount)) return false;
  if (amount < MIN_BID || amount > MAX_BID) return false;
  if (amount % BID_INCREMENT !== 0) return false;
  return true;
}

/** Place a bid. Returns the new state, or an error if invalid. */
export function placeBid(state: BidState, seat: Seat, amount: number): BidActionResult {
  if (state.complete) return { ok: false, error: 'NOT_IN_GAME' };
  if (!isValidAmount(amount)) return { ok: false, error: 'INVALID_AMOUNT' };
  if (state.currentBid !== null && amount <= state.currentBid) {
    return { ok: false, error: 'NOT_HIGHER' };
  }

  const newState: BidState = {
    currentBid: amount,
    currentBidderSeat: seat,
    passedSeats: [],
    complete: false,
  };
  return { ok: true, state: newState, justCompleted: false };
}

/** Pass on the current bid. Returns the new state. */
export function passBid(state: BidState, seat: Seat): BidActionResult {
  if (state.complete) return { ok: false, error: 'NOT_IN_GAME' };
  if (state.currentBid === null) return { ok: false, error: 'NO_BID_TO_PASS' };
  if (state.currentBidderSeat === seat) return { ok: false, error: 'ALREADY_BIDDER' };

  const passedSeats = state.passedSeats.includes(seat)
    ? state.passedSeats
    : [...state.passedSeats, seat];

  const otherSeats: Seat[] = ([1, 2, 3, 4] as Seat[]).filter((s) => s !== state.currentBidderSeat);
  const allPassed = otherSeats.every((s) => passedSeats.includes(s));
  const newState: BidState = {
    ...state,
    passedSeats,
    complete: allPassed,
  };
  return { ok: true, state: newState, justCompleted: allPassed && !state.complete };
}

/** Pure predicate. */
export function isBiddingComplete(state: BidState): boolean {
  return state.complete;
}
