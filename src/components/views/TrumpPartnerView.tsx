'use client';
import type { RoomView, Player, Card, Suit } from '@/shared/types';
import { TrumpPartnerModal } from '@/components/trump-partner/TrumpPartnerModal';
import { WaitingForChoice } from '@/components/trump-partner/WaitingForChoice';
import { HandPreview } from '@/components/bidding/HandPreview';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';

interface Props {
  room: RoomView;
  me: Player;
  yourHand: Card[];
  busy: boolean;
  onConfirm: (trump: Suit, called: Card) => void;
  onSendChat: (text: string) => void;
}

export function TrumpPartnerView({ room, me, yourHand, busy, onConfirm, onSendChat }: Props) {
  const bidderSeat = room.game?.bid.currentBidderSeat ?? null;
  const bidderName = seatNameFor(room.players, bidderSeat);
  const isBidder = bidderSeat === me.seat;

  return (
    <main className="min-h-screen p-6 flex flex-col items-center gap-4">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-widest text-gold-500 font-bold">Trump &amp; partner</div>
        <div className="text-xs text-neutral-400 mt-1">Bid {room.game?.bid.currentBid} · {bidderName}</div>
      </div>

      {isBidder ? (
        <TrumpPartnerModal yourHand={yourHand} busy={busy} onConfirm={onConfirm} />
      ) : (
        <WaitingForChoice bidderName={bidderName} />
      )}

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500 text-center mb-2">your hand</div>
        <HandPreview hand={yourHand} />
      </div>

      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
