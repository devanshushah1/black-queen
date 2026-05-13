'use client';
import type { BidState, Seat } from '@/shared/types';
import { MIN_BID, MAX_BID, BID_INCREMENT } from '@/shared/types';

interface BidPanelProps {
  bid: BidState;
  yourSeat: Seat;
  /** Disabled until the user resolves a pending action. */
  busy?: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

export function BidPanel({ bid, yourSeat, busy, onBid, onPass }: BidPanelProps) {
  const isCurrentBidder = bid.currentBidderSeat === yourSeat;
  const youPassed = bid.passedSeats.includes(yourSeat) && !isCurrentBidder;

  const nextMin = bid.currentBid === null ? MIN_BID : bid.currentBid + BID_INCREMENT;
  const visibleAmounts: number[] = [];
  for (let a = nextMin; a <= MAX_BID && visibleAmounts.length < 8; a += BID_INCREMENT) {
    visibleAmounts.push(a);
  }

  return (
    <div className="w-[360px] mx-auto bg-felt-900/95 border border-gold-500/40 rounded-2xl p-5 shadow-2xl">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] uppercase tracking-widest text-gold-500 font-bold">● Bidding</span>
        <span className="text-[10px] text-neutral-500">no timer · waits for passes</span>
      </div>

      <div className="text-center py-3">
        {bid.currentBid === null ? (
          <>
            <div className="text-4xl font-bold text-gold-500 leading-none">—</div>
            <div className="text-xs text-neutral-400 mt-1">no bid yet · floor {MIN_BID}</div>
          </>
        ) : (
          <>
            <div className="text-5xl font-bold text-gold-500 leading-none">{bid.currentBid}</div>
            <div className="text-xs text-neutral-300 mt-1">
              held by <b className={isCurrentBidder ? 'text-gold-500' : 'text-white'}>seat {bid.currentBidderSeat}</b>
            </div>
          </>
        )}
      </div>

      <div className={`grid grid-cols-4 gap-2 mb-3 ${youPassed ? 'opacity-30 pointer-events-none' : ''}`}>
        {visibleAmounts.map((amt) => {
          const delta = bid.currentBid === null ? null : amt - bid.currentBid;
          return (
            <button
              key={amt}
              type="button"
              disabled={busy}
              onClick={() => onBid(amt)}
              className="bg-gradient-to-b from-felt-700 to-felt-800 hover:from-felt-800 hover:to-felt-900 hover:border-gold-500 border border-gold-500/25 text-white text-sm font-bold rounded-lg py-2 disabled:opacity-50"
            >
              {delta !== null && <span className="block text-[9px] text-gold-500 font-medium">+{delta}</span>}
              {amt}
            </button>
          );
        })}
      </div>

      {bid.currentBid !== null && !isCurrentBidder && (
        <button
          type="button"
          disabled={busy || youPassed}
          onClick={onPass}
          className="w-full bg-white/5 hover:bg-red-400/15 hover:border-red-400 border border-white/15 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
        >
          {youPassed ? 'Passed' : `Pass at ${bid.currentBid}`}
        </button>
      )}

      {youPassed && (
        <div className="text-center text-[11px] text-gold-500 mt-2">You passed. Waiting for others.</div>
      )}
    </div>
  );
}
