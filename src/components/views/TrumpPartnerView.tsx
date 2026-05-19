'use client';
import type { RoomView, Player, Card, Suit } from '@/shared/types';
import { TrumpPartnerModal } from '@/components/trump-partner/TrumpPartnerModal';
import { WaitingForChoice } from '@/components/trump-partner/WaitingForChoice';
import { PlayerHand } from '@/components/play/PlayerHand';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';
import { MuteToggle } from '@/components/MuteToggle';

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
    <main className="min-h-screen relative bg-[#020b08] felt-grain p-6 overflow-hidden flex flex-col justify-between items-center select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gold-500/[0.02] rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-felt-500/[0.03] rounded-full filter blur-[150px] pointer-events-none" />

      <MuteToggle />
      
      {/* Header Info Badges */}
      <div className="text-center z-20 mt-2">
        <div className="px-4 py-1.5 bg-black/45 backdrop-blur-md border border-white/10 rounded-full text-[10px] uppercase tracking-widest text-gold-400 font-extrabold flex items-center justify-center gap-1.5 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-pulse" />
          Trump &amp; Partner Selection
        </div>
        <div className="text-[11px] font-bold text-neutral-400 mt-2 tracking-wide">
          Winning Bid: <span className="text-gold-300 font-extrabold">{room.game?.bid.currentBid}</span> Points · Selected by <span className="text-white font-extrabold">{bidderName}</span>
        </div>
      </div>

      {/* Modal / Waiting Zone */}
      <div className="w-full flex justify-center items-center z-20 my-auto">
        {isBidder ? (
          <TrumpPartnerModal yourHand={yourHand} busy={busy} onConfirm={onConfirm} />
        ) : (
          <WaitingForChoice bidderName={bidderName} />
        )}
      </div>

      {/* Hand Preview (Spectacular Full Fan) */}
      <div className="w-full max-w-4xl mx-auto z-20">
        <div className="text-[10px] uppercase tracking-widest text-neutral-400 text-center mb-2 font-extrabold">
          Your Cards
        </div>
        <PlayerHand hand={yourHand} legalKeys={null} active={false} onPlay={() => {}} />
        <div className="text-center mt-3">
          <span className="inline-block text-xs font-extrabold text-white/90 px-4 py-1 rounded-full bg-gold-500/[0.08] border border-gold-500/30 shadow-glass-gold">
            {me.name} (You)
          </span>
        </div>
      </div>

      {/* Floating Chat Widget */}
      <div className="fixed bottom-4 right-4 z-40">
        <ChatPanel messages={room.chat} onSend={onSendChat} />
      </div>
    </main>
  );
}
