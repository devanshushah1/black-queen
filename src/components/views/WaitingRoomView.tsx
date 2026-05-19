'use client';
import type { RoomView, Player, Seat } from '@/shared/types';
import { Seat as SeatComp } from '@/components/Seat';
import { InviteCard } from '@/components/InviteCard';
import { StartCard } from '@/components/StartCard';
import { ChatPanel } from '@/components/ChatPanel';
import { MuteToggle } from '@/components/MuteToggle';

function rotate(viewerSeat: Seat) {
  return {
    bottom: viewerSeat,
    left: (viewerSeat % 4) + 1,
    top: ((viewerSeat + 1) % 4) + 1,
    right: ((viewerSeat + 2) % 4) + 1,
  };
}

interface Props {
  room: RoomView;
  me: Player;
  sessionId: string;
  onStart: () => void;
  onSendChat: (text: string) => void;
}

export function WaitingRoomView({ room, me, sessionId, onStart, onSendChat }: Props) {
  const layout = rotate(me.seat);
  const at = (seat: number): Player | null => room.players.find((p) => p.seat === seat) ?? null;
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${room.code}` : `/room/${room.code}`;
  const isHost = room.hostId === sessionId;
  const isFull = room.players.length >= 4;

  return (
    <main className="min-h-screen relative bg-[#020b08] felt-grain p-6 overflow-hidden flex flex-col justify-between select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gold-500/[0.02] rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-felt-500/[0.03] rounded-full filter blur-[150px] pointer-events-none" />

      <MuteToggle />

      {/* Header Info */}
      <div className="flex items-center justify-between mb-4 max-w-3xl w-full mx-auto z-20 bg-black/45 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-glass">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-gold-400 font-extrabold flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-gold-400" />
            Lounge Code
          </div>
          <div className="text-2xl font-extrabold text-gold-400 font-mono tracking-widest mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{room.code}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-widest text-neutral-400 font-extrabold">Active Seats</div>
          <div className="text-lg font-extrabold text-gold-300 mt-1">{room.players.length} <span className="text-white/40 font-medium">/ 4</span></div>
        </div>
      </div>

      {/* 4-Seat Round Table Setup */}
      <div className="relative mx-auto max-w-3xl w-full h-80 my-auto flex items-center justify-center z-20">
        {/* Ornate table backdrop circle */}
        <div className="absolute w-[360px] h-[360px] rounded-full border-[8px] border-double border-[#2a170d] bg-gradient-to-b from-[#0c5537] via-[#073523] to-[#03140e] shadow-[inset_0_8px_16px_rgba(0,0,0,0.6),0_12px_24px_rgba(0,0,0,0.7)] felt-grain pointer-events-none flex items-center justify-center">
          <div className="w-[280px] h-[280px] rounded-full border border-gold-500/10 pointer-events-none flex items-center justify-center opacity-30">
            <span className="text-gold-400 text-6xl font-serif">♛</span>
          </div>
        </div>

        {/* Diagonal seated players */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 transform -translate-y-4"><SeatComp player={at(layout.top)} seatLabel={`seat ${layout.top}`} isHost={!!at(layout.top) && at(layout.top)!.id === room.hostId} /></div>
        <div className="absolute top-1/2 left-4 -translate-y-1/2 transform -translate-x-8"><SeatComp player={at(layout.left)} seatLabel={`seat ${layout.left}`} isHost={!!at(layout.left) && at(layout.left)!.id === room.hostId} /></div>
        <div className="absolute top-1/2 right-4 -translate-y-1/2 transform translate-x-8"><SeatComp player={at(layout.right)} seatLabel={`seat ${layout.right}`} isHost={!!at(layout.right) && at(layout.right)!.id === room.hostId} /></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 transform translate-y-4"><SeatComp player={me} seatLabel={`seat ${layout.bottom}`} isYou isHost={isHost} /></div>
      </div>

      {/* Control Panel Widgets */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-6 z-20 w-full max-w-3xl mx-auto mb-2">
        <InviteCard code={room.code} url={inviteUrl} disabled={isFull} />
        <StartCard filled={room.players.length} isHost={isHost} onStart={onStart} />
      </div>

      {/* Floating Chat Panel */}
      <div className="fixed bottom-4 right-4 z-40">
        <ChatPanel messages={room.chat} onSend={onSendChat} />
      </div>
    </main>
  );
}
