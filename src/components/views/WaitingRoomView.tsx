'use client';
import type { RoomView, Player, Seat } from '@/shared/types';
import { Seat as SeatComp } from '@/components/Seat';
import { InviteCard } from '@/components/InviteCard';
import { StartCard } from '@/components/StartCard';
import { ChatPanel } from '@/components/ChatPanel';

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
    <main className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-4 max-w-3xl mx-auto">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-neutral-400">Room</div>
          <div className="text-xl font-bold text-gold-500 font-mono tracking-widest">{room.code}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-widest text-neutral-400">Players</div>
          <div className="text-sm font-semibold text-gold-500">{room.players.length} / 4</div>
        </div>
      </div>
      <div className="relative mx-auto max-w-3xl h-72">
        <div className="absolute top-0 left-1/2 -translate-x-1/2"><SeatComp player={at(layout.top)} seatLabel={`seat ${layout.top}`} isHost={!!at(layout.top) && at(layout.top)!.id === room.hostId} /></div>
        <div className="absolute top-1/2 left-8 -translate-y-1/2"><SeatComp player={at(layout.left)} seatLabel={`seat ${layout.left}`} isHost={!!at(layout.left) && at(layout.left)!.id === room.hostId} /></div>
        <div className="absolute top-1/2 right-8 -translate-y-1/2"><SeatComp player={at(layout.right)} seatLabel={`seat ${layout.right}`} isHost={!!at(layout.right) && at(layout.right)!.id === room.hostId} /></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2"><SeatComp player={me} seatLabel={`seat ${layout.bottom}`} isYou isHost={isHost} /></div>
      </div>
      <div className="flex justify-center gap-4 mt-4">
        <InviteCard code={room.code} url={inviteUrl} disabled={isFull} />
        <StartCard filled={room.players.length} isHost={isHost} onStart={onStart} />
      </div>
      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
