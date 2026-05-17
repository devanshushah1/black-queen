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
    <main className="min-h-screen relative bg-felt-900 p-6">
      <MuteToggle />
      {dealing && <DealAnimation viewerSeat={me.seat} onDone={() => setDealing(false)} />}

      {!dealing && (
        <>
          <div className="absolute top-3 left-3 text-[10px] uppercase tracking-widest text-gold-500 font-bold">
            Bidding phase
            <span className="ml-2 text-neutral-400 normal-case tracking-normal font-normal">
              Min 75 · Max 150 · Increments of 5
            </span>
          </div>

          <div className="relative max-w-4xl mx-auto mt-6 h-[420px]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
              <OpponentFan count={13} orientation="top" />
              <div className="text-xs font-semibold text-white mt-1">{nameAt(layout.top)}</div>
              <StatusPill {...seatStatus(layout.top)} />
            </div>
            <div className="absolute top-1/2 left-2 -translate-y-1/2 text-center">
              <OpponentFan count={13} orientation="left" />
              <div className="text-xs font-semibold text-white mt-1">{nameAt(layout.left)}</div>
              <StatusPill {...seatStatus(layout.left)} />
            </div>
            <div className="absolute top-1/2 right-2 -translate-y-1/2 text-center">
              <OpponentFan count={13} orientation="right" />
              <div className="text-xs font-semibold text-white mt-1">{nameAt(layout.right)}</div>
              <StatusPill {...seatStatus(layout.right)} />
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <BidPanel bid={bid} yourSeat={me.seat} busy={busy} onBid={onBid} onPass={onPass} />
            </div>
          </div>

          <div className="max-w-4xl mx-auto mt-4">
            <PlayerHand hand={yourHand} legalKeys={null} active={false} onPlay={() => { /* view-only during bidding */ }} />
            <div className="text-center mt-2">
              <span className="text-sm font-semibold text-white">{me.name} (you)</span>
              <span className="ml-2"><StatusPill {...seatStatus(me.seat)} /></span>
            </div>
          </div>
        </>
      )}

      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
