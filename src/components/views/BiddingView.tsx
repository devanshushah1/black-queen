'use client';
import { useEffect, useState } from 'react';
import type { RoomView, Player, Seat, Card } from '@/shared/types';
import { BidPanel } from '@/components/bidding/BidPanel';
import { StatusPill } from '@/components/bidding/StatusPill';
import { PlayerHand } from '@/components/play/PlayerHand';
import { OpponentFan } from '@/components/play/OpponentFan';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';
import { MuteToggle } from '@/components/MuteToggle';
import { DealAnimation } from '@/components/play/DealAnimation';

function rotate(viewerSeat: Seat) {
  return {
    bottom: viewerSeat,
    left: ((viewerSeat % 4) + 1) as Seat,
    top: (((viewerSeat + 1) % 4) + 1) as Seat,
    right: (((viewerSeat + 2) % 4) + 1) as Seat,
  };
}

interface Props {
  room: RoomView;
  me: Player;
  yourHand: Card[];
  busy: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
  onSendChat: (text: string) => void;
}

export function BiddingView({ room, me, yourHand, busy, onBid, onPass, onSendChat }: Props) {
  const bid = room.game!.bid;
  const isFreshDeal = bid.currentBid === null && bid.passedSeats.length === 0;
  const [dealing, setDealing] = useState(isFreshDeal);

  useEffect(() => {
    if (!isFreshDeal) setDealing(false);
  }, [isFreshDeal]);

  const layout = rotate(me.seat);

  const seatStatus = (seat: Seat) => {
    if (bid.currentBidderSeat === seat) return { variant: 'bidder' as const, label: `bid ${bid.currentBid}` };
    if (bid.passedSeats.includes(seat)) return { variant: 'passed' as const, label: 'passed' };
    return { variant: 'live' as const, label: 'deciding…', pulse: true };
  };

  const nameAt = (seat: Seat) => seatNameFor(room.players, seat);

  return (
    <main className="min-h-screen relative bg-[#020b08] felt-grain p-6 overflow-hidden flex flex-col justify-between select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gold-500/[0.02] rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-felt-500/[0.03] rounded-full filter blur-[150px] pointer-events-none" />

      <MuteToggle />
      {dealing && <DealAnimation viewerSeat={me.seat} onDone={() => setDealing(false)} />}

      {!dealing && (
        <>
          {/* Elegant Top-Left Phase Badge */}
          <div className="absolute top-4 left-4 z-40 px-3.5 py-1.5 bg-black/45 backdrop-blur-md border border-white/10 rounded-full text-[9px] uppercase tracking-widest text-gold-400 font-extrabold flex items-center gap-2 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-pulse" />
            Bidding phase
            <span className="text-white/60 font-bold ml-1 border-l border-white/10 pl-2">
              Min 75 · Max 150 · Steps of 5
            </span>
          </div>

          {/* Table Mat Area */}
          <div className="relative max-w-4xl w-full mx-auto mt-6 h-[400px] flex items-center justify-center">
            
            {/* Luxury Mahogany Wood Oval Mat Backdrop */}
            <div className="absolute w-[94%] h-[92%] rounded-[120px] border-[10px] border-double border-[#2a170d] bg-gradient-to-b from-[#0c5537] via-[#073523] to-[#03140e] shadow-[inset_0_12px_24px_rgba(0,0,0,0.7),0_20px_40px_rgba(0,0,0,0.9)] felt-grain pointer-events-none">
              <div className="absolute inset-8 rounded-[90px] border border-gold-500/10 pointer-events-none" />
            </div>

            {/* Top Opponent (North) */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-center z-20 transition-all duration-300">
              <OpponentFan count={13} orientation="top" />
              <div className="mt-1.5 flex flex-col items-center gap-1">
                <div className="text-xs font-extrabold text-white/90 px-3 py-0.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 shadow-sm">
                  {nameAt(layout.top)}
                </div>
                <StatusPill {...seatStatus(layout.top)} />
              </div>
            </div>

            {/* Left Opponent (West) */}
            <div className="absolute top-1/2 left-3 -translate-y-1/2 text-center z-20 transition-all duration-300">
              <OpponentFan count={13} orientation="left" />
              <div className="mt-2 flex flex-col items-center gap-1">
                <div className="text-xs font-extrabold text-white/90 px-3 py-0.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 shadow-sm">
                  {nameAt(layout.left)}
                </div>
                <StatusPill {...seatStatus(layout.left)} />
              </div>
            </div>

            {/* Right Opponent (East) */}
            <div className="absolute top-1/2 right-3 -translate-y-1/2 text-center z-20 transition-all duration-300">
              <OpponentFan count={13} orientation="right" />
              <div className="mt-2 flex flex-col items-center gap-1">
                <div className="text-xs font-extrabold text-white/90 px-3 py-0.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 shadow-sm">
                  {nameAt(layout.right)}
                </div>
                <StatusPill {...seatStatus(layout.right)} />
              </div>
            </div>

            {/* Center Bid Panel */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
              <BidPanel bid={bid} yourSeat={me.seat} busy={busy} onBid={onBid} onPass={onPass} />
            </div>
          </div>

          {/* Player Hand Area */}
          <div className="max-w-4xl w-full mx-auto mt-4 z-20">
            <PlayerHand hand={yourHand} legalKeys={null} active={false} onPlay={() => {}} />
            <div className="text-center mt-3 flex flex-col items-center gap-1">
              <div className="inline-block text-sm font-extrabold text-white/95 px-4 py-1 rounded-full bg-gold-500/[0.08] border border-gold-500/30 shadow-glass-gold">
                {me.name} (You)
              </div>
              <div className="scale-95">
                <StatusPill {...seatStatus(me.seat)} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Floating Chat Panel */}
      <div className="fixed bottom-4 right-4 z-40">
        <ChatPanel messages={room.chat} onSend={onSendChat} />
      </div>
    </main>
  );
}
