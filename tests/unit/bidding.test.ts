import { describe, it, expect } from 'vitest';
import { emptyBidState, placeBid, passBid, isBiddingComplete } from '@/server/game/bidding';

describe('emptyBidState', () => {
  it('returns null bid, no bidder, no passes, not complete', () => {
    const s = emptyBidState();
    expect(s.currentBid).toBeNull();
    expect(s.currentBidderSeat).toBeNull();
    expect(s.passedSeats).toEqual([]);
    expect(s.complete).toBe(false);
  });
});

describe('placeBid', () => {
  it('accepts a valid opening bid (75, by seat 2)', () => {
    const res = placeBid(emptyBidState(), 2, 75);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.currentBid).toBe(75);
    expect(res.state.currentBidderSeat).toBe(2);
    expect(res.state.passedSeats).toEqual([]);
    expect(res.justCompleted).toBe(false);
  });

  it('rejects below minimum bid (74)', () => {
    const res = placeBid(emptyBidState(), 1, 74);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_AMOUNT');
  });

  it('rejects above maximum bid (155)', () => {
    const res = placeBid(emptyBidState(), 1, 155);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_AMOUNT');
  });

  it('rejects non-multiple-of-5 amount (78)', () => {
    const res = placeBid(emptyBidState(), 1, 78);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_AMOUNT');
  });

  it('rejects a follow-up bid that is not higher than current', () => {
    const after = placeBid(emptyBidState(), 1, 90);
    if (!after.ok) throw new Error('precondition');
    const res = placeBid(after.state, 2, 90);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NOT_HIGHER');
  });

  it('accepts a higher follow-up bid and resets passedSeats', () => {
    let state = emptyBidState();
    state = (placeBid(state, 1, 90) as any).state;
    state = (passBid(state, 2) as any).state;
    state = (passBid(state, 3) as any).state;
    expect(state.passedSeats).toEqual([2, 3]);
    const res = placeBid(state, 4, 95);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.currentBid).toBe(95);
    expect(res.state.currentBidderSeat).toBe(4);
    expect(res.state.passedSeats).toEqual([]);
  });

  it('allows the current bidder to self-raise', () => {
    const a = placeBid(emptyBidState(), 1, 90);
    if (!a.ok) throw new Error('precondition');
    const b = placeBid(a.state, 1, 95);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.state.currentBidderSeat).toBe(1);
    expect(b.state.currentBid).toBe(95);
  });
});

describe('passBid', () => {
  it('rejects pass when there is no bid yet', () => {
    const res = passBid(emptyBidState(), 1);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NO_BID_TO_PASS');
  });

  it('rejects pass by the current bidder', () => {
    const a = placeBid(emptyBidState(), 1, 90);
    if (!a.ok) throw new Error('precondition');
    const res = passBid(a.state, 1);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('ALREADY_BIDDER');
  });

  it('adds the seat to passedSeats once (idempotent)', () => {
    const a = placeBid(emptyBidState(), 1, 90);
    if (!a.ok) throw new Error('precondition');
    let s = a.state;
    s = (passBid(s, 2) as any).state;
    s = (passBid(s, 2) as any).state;
    expect(s.passedSeats).toEqual([2]);
  });

  it('marks complete + justCompleted when 3 non-bidders have passed', () => {
    const a = placeBid(emptyBidState(), 1, 90);
    if (!a.ok) throw new Error('precondition');
    let s = a.state;
    let r = passBid(s, 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.justCompleted).toBe(false);
    s = r.state;

    r = passBid(s, 3);
    if (!r.ok) return;
    expect(r.justCompleted).toBe(false);
    s = r.state;

    r = passBid(s, 4);
    if (!r.ok) return;
    expect(r.justCompleted).toBe(true);
    expect(r.state.complete).toBe(true);
  });
});

describe('isBiddingComplete', () => {
  it('false on empty state', () => {
    expect(isBiddingComplete(emptyBidState())).toBe(false);
  });

  it('true once 3 non-bidder seats have passed', () => {
    const a = placeBid(emptyBidState(), 2, 90);
    if (!a.ok) throw new Error('precondition');
    let s = a.state;
    s = (passBid(s, 1) as any).state;
    s = (passBid(s, 3) as any).state;
    s = (passBid(s, 4) as any).state;
    expect(isBiddingComplete(s)).toBe(true);
  });
});
