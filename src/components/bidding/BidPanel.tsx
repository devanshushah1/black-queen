'use client';
import type { BidState, Seat } from '@/shared/types';
import { MIN_BID, MAX_BID, BID_INCREMENT } from '@/shared/types';

interface BidPanelProps {
  bid: BidState;
  yourSeat: Seat;
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
    <div
      data-testid="bid-panel"
      className="w-[360px] h-[290px] mx-auto bg-felt-900/95 border border-gold-500/40 rounded-2xl p-5 shadow-2xl flex flex-col"
    >
      {/* Header: status + meta. Fixed height. */}
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] uppercase tracking-widest text-gold-500 font-bold">● Bidding</span>
        <span className="text-[10px] text-neutral-500">no timer · waits for passes</span>
      </div>

      {/* Current bid display. Fixed height of 60px regardless of state. */}
      <div className="text-center h-[60px] flex flex-col justify-center">
        {bid.currentBid === null ? (
          <>
            <div className="text-4xl font-bold text-gold-500 leading-none">—</div>
            <div className="text-xs text-neutral-400 mt-1">no bid yet · floor {MIN_BID}</div>
          </>
        ) : (
          <>
            <div className="text-4xl font-bold text-gold-500 leading-none">{bid.currentBid}</div>
            <div className="text-xs text-neutral-300 mt-1">
              held by <b className={isCurrentBidder ? 'text-gold-500' : 'text-white'}>seat {bid.currentBidderSeat}</b>
            </div>
          </>
        )}
      </div>

      {/* Quick-bid grid: always 2×4 (or shorter if MAX_BID is close). Fixed height. */}
      <div className={`grid grid-cols-4 grid-rows-2 gap-2 mt-2 ${youPassed ? 'opacity-30 pointer-events-none' : ''}`}>
        {Array.from({ length: 8 }).map((_, i) => {
          const amt = visibleAmounts[i];
          if (amt === undefined) {
            // Reserve slot for layout stability when fewer than 8 bids remain.
            return <div key={`empty-${i}`} className="h-9" />;
          }
          const delta = bid.currentBid === null ? null : amt - bid.currentBid;
          return (
            <button
              key={amt}
              type="button"
              disabled={busy}
              onClick={() => onBid(amt)}
              className="bg-gradient-to-b from-felt-700 to-felt-800 hover:from-felt-800 hover:to-felt-900 hover:border-gold-500 border border-gold-500/25 text-white text-sm font-bold rounded-lg h-9 disabled:opacity-50"
            >
              {delta !== null && <span className="block text-[9px] text-gold-500 font-medium leading-none">+{delta}</span>}
              {amt}
            </button>
          );
        })}
      </div>

      {/* Pass row: fixed height reserved either way. */}
      <div className="mt-2 h-9">
        {bid.currentBid !== null && !isCurrentBidder ? (
          <button
            type="button"
            disabled={busy || youPassed}
            onClick={onPass}
            className="w-full h-full bg-white/5 hover:bg-red-400/15 hover:border-red-400 border border-white/15 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {youPassed ? 'Passed' : `Pass at ${bid.currentBid}`}
          </button>
        ) : null}
      </div>

      {youPassed && (
        <div className="text-center text-[11px] text-gold-500 mt-1">You passed. Waiting for others.</div>
      )}
    </div>
  );
}
