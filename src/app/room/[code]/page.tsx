'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { selectMe, useGameStore } from '@/client/store';
import { Seat } from '@/components/Seat';
import { InviteCard } from '@/components/InviteCard';
import { StartCard } from '@/components/StartCard';
import { ChatPanel } from '@/components/ChatPanel';
import type { JoinRoomResult, Player, StartGameResult } from '@/shared/types';

function rotateSeats(viewerSeat: 1 | 2 | 3 | 4) {
  return {
    bottom: viewerSeat,
    left: (viewerSeat % 4) + 1,
    top: ((viewerSeat + 1) % 4) + 1,
    right: ((viewerSeat + 2) % 4) + 1,
  };
}

export default function WaitingRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const router = useRouter();
  const socket = useSocket();

  const room = useGameStore((s) => s.room);
  const sessionId = useGameStore((s) => s.sessionId);
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const me = useGameStore(selectMe);

  const [joinName, setJoinName] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);

  useEffect(() => {
    if (room && room.phase !== 'lobby') router.push('/game-starting');
  }, [room, router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinErr(null);
    if (!joinName.trim()) {
      setJoinErr('Pick a display name');
      return;
    }
    setJoinBusy(true);
    const res = await new Promise<JoinRoomResult>((resolve) =>
      socket.emit('room:join', { code, name: joinName.trim() }, resolve)
    );
    setJoinBusy(false);
    if (!res.ok) {
      setJoinErr(
        res.error === 'NOT_FOUND' ? 'Room not found.'
        : res.error === 'FULL' ? 'Room is full.'
        : res.error === 'NAME_TAKEN' ? 'Name is taken.'
        : 'Invalid name.'
      );
      return;
    }
    setSession(res.sessionId);
    setRoom(res.room);
  }

  // Not in the room yet — show the join form.
  if (!sessionId || !me) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">
        <div className="text-center">
          <div className="text-gold-500 text-5xl font-serif leading-none">♛</div>
          <div className="text-xl font-bold mt-1">Black Queen</div>
        </div>
        <div className="w-80 bg-black/40 border border-white/10 rounded-xl p-5">
          <div className="text-center text-xs text-neutral-400">You&apos;ve been invited to room</div>
          <div className="text-center text-lg font-mono font-bold text-gold-500 mt-1">{code}</div>

          <form onSubmit={handleJoin} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">Your display name</label>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={20}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500"
                placeholder="Pick something fun"
              />
            </div>
            <button
              type="submit"
              disabled={joinBusy}
              className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-black font-bold rounded-lg py-2.5 text-sm"
            >
              Join room
            </button>
            {joinErr && <div className="text-red-400 text-xs text-center">{joinErr}</div>}
          </form>
        </div>
      </main>
    );
  }

  // In the room — render the waiting room.
  const seatLayout = rotateSeats(me.seat);
  const playerAt = (seat: number): Player | null =>
    room?.players.find((p) => p.seat === seat) ?? null;

  function handleStart() {
    socket.emit('room:start', (res: StartGameResult) => {
      if (!res.ok) console.warn('Start failed:', res.error);
    });
  }

  function handleSendChat(text: string) {
    socket.emit('chat:send', { text });
  }

  if (!room) {
    return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;
  }

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
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
          <Seat
            player={playerAt(seatLayout.top)}
            seatLabel={`seat ${seatLayout.top}`}
            isHost={!!playerAt(seatLayout.top) && playerAt(seatLayout.top)!.id === room.hostId}
          />
        </div>
        <div className="absolute top-1/2 left-8 -translate-y-1/2">
          <Seat
            player={playerAt(seatLayout.left)}
            seatLabel={`seat ${seatLayout.left}`}
            isHost={!!playerAt(seatLayout.left) && playerAt(seatLayout.left)!.id === room.hostId}
          />
        </div>
        <div className="absolute top-1/2 right-8 -translate-y-1/2">
          <Seat
            player={playerAt(seatLayout.right)}
            seatLabel={`seat ${seatLayout.right}`}
            isHost={!!playerAt(seatLayout.right) && playerAt(seatLayout.right)!.id === room.hostId}
          />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <Seat player={me} seatLabel={`seat ${seatLayout.bottom}`} isYou isHost={isHost} />
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-4">
        <InviteCard code={room.code} url={inviteUrl} disabled={isFull} />
        <StartCard filled={room.players.length} isHost={isHost} onStart={handleStart} />
      </div>

      <div className="fixed bottom-3 right-3">
        <ChatPanel messages={room.chat} onSend={handleSendChat} />
      </div>
    </main>
  );
}
