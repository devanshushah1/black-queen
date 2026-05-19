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
      className="w-[360px] h-[310px] mx-auto bg-black/45 backdrop-blur-xl border border-gold-500/35 rounded-2xl p-5 shadow-glass-gold flex flex-col justify-between transition-all duration-300"
    >
      {/* Header: status + meta */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] uppercase tracking-widest text-gold-400 font-extrabold flex items-center gap-1.5 animate-pulse-slow">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
          Auction Phase
        </span>
        <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-medium">Wait for passes</span>
      </div>

      {/* Current bid display */}
      <div className="text-center h-[70px] flex flex-col justify-center bg-white/[0.02] border border-white/5 rounded-xl my-1 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gold-500/[0.01] pointer-events-none" />
        
        {bid.currentBid === null ? (
          <>
            <div className="text-3xl font-extrabold text-white/40 font-serif leading-none">—</div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 mt-1">Floor: {MIN_BID} Points</div>
          </>
        ) : (
          <>
            <div className="text-4xl font-extrabold text-gold-400 font-serif leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              {bid.currentBid}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-300 mt-1.5">
              Held by <span className={isCurrentBidder ? 'text-gold-300 font-extrabold' : 'text-white/80 font-bold'}>Seat {bid.currentBidderSeat}</span>
            </div>
          </>
        )}
      </div>

      {/* Quick-bid grid: always 2×4 */}
      <div className={`grid grid-cols-4 grid-rows-2 gap-2 mt-1 ${youPassed ? 'opacity-25 pointer-events-none' : ''}`}>
        {Array.from({ length: 8 }).map((_, i) => {
          const amt = visibleAmounts[i];
          if (amt === undefined) {
            return <div key={`empty-${i}`} className="h-9" />;
          }
          const delta = bid.currentBid === null ? null : amt - bid.currentBid;
          return (
            <button
              key={amt}
              type="button"
              disabled={busy}
              onClick={() => onBid(amt)}
              className="relative overflow-hidden group bg-gradient-to-b from-[#1b362a] to-[#0e2118] hover:from-[#244b39] hover:to-[#143224] border border-gold-500/20 hover:border-gold-500 text-white text-xs font-bold rounded-lg h-9 transition-all duration-200 shadow-sm flex flex-col justify-center items-center"
            >
              {/* Gold button gloss sheen */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {delta !== null && (
                <span className="text-[8px] text-gold-400 font-extrabold leading-none mb-0.5 tracking-tighter">+{delta}</span>
              )}
              <span className="text-white group-hover:text-gold-300 leading-none">{amt}</span>
            </button>
          );
        })}
      </div>

      {/* Pass row */}
      <div className="mt-1 h-9">
        {bid.currentBid !== null && !isCurrentBidder ? (
          <button
            type="button"
            disabled={busy || youPassed}
            onClick={onPass}
            className="w-full h-full bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 hover:border-red-500/60 text-red-300 hover:text-red-200 rounded-lg text-xs font-bold transition-all duration-300 shadow-sm"
          >
            {youPassed ? 'Passed' : `Pass at ${bid.currentBid}`}
          </button>
        ) : null}
      </div>

      {youPassed && (
        <div className="text-center text-[10px] text-gold-400/90 font-bold uppercase tracking-widest animate-pulse mt-0.5">
          You Passed · Waiting...
        </div>
      )}
    </div>
  );
}
