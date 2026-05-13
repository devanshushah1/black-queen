'use client';
import type { RoomView, Player, Seat, Card } from '@/shared/types';
import { BidPanel } from '@/components/bidding/BidPanel';
import { StatusPill } from '@/components/bidding/StatusPill';
import { HandPreview } from '@/components/bidding/HandPreview';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';

function rotate(viewerSeat: Seat) {
  return { bottom: viewerSeat, left: (viewerSeat % 4) + 1, top: ((viewerSeat + 1) % 4) + 1, right: ((viewerSeat + 2) % 4) + 1 };
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
  const layout = rotate(me.seat);

  const seatStatus = (seat: number) => {
    if (bid.currentBidderSeat === seat) return { variant: 'bidder' as const, label: `bid ${bid.currentBid}` };
    if (bid.passedSeats.includes(seat as Seat)) return { variant: 'passed' as const, label: 'passed' };
    return { variant: 'live' as const, label: 'deciding…', pulse: true };
  };

  const nameAt = (seat: number) => seatNameFor(room.players, seat);

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-4">
          <div className="text-[10px] uppercase tracking-widest text-gold-500 font-bold">Bidding phase</div>
          <div className="text-xs text-neutral-400 mt-1">Min 75 · Max 150 · Increments of 5</div>
        </div>

        <div className="relative h-56 mb-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
            <div className="text-sm font-semibold">{nameAt(layout.top)}</div>
            <StatusPill {...seatStatus(layout.top)} />
          </div>
          <div className="absolute top-1/2 left-8 -translate-y-1/2 text-center">
            <div className="text-sm font-semibold">{nameAt(layout.left)}</div>
            <StatusPill {...seatStatus(layout.left)} />
          </div>
          <div className="absolute top-1/2 right-8 -translate-y-1/2 text-center">
            <div className="text-sm font-semibold">{nameAt(layout.right)}</div>
            <StatusPill {...seatStatus(layout.right)} />
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
            <BidPanel bid={bid} yourSeat={me.seat} busy={busy} onBid={onBid} onPass={onPass} />
          </div>
        </div>

        <div className="mt-8">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500 text-center mb-2">your hand</div>
          <HandPreview hand={yourHand} />
          <div className="text-center mt-3">
            <span className="text-sm font-semibold">{me.name}</span>
            <span className="ml-2"><StatusPill {...seatStatus(me.seat)} /></span>
          </div>
        </div>
      </div>
      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
