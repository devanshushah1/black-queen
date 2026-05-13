'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { selectMe, useGameStore } from '@/client/store';
import { JoinView } from '@/components/views/JoinView';
import { WaitingRoomView } from '@/components/views/WaitingRoomView';
import { BiddingView } from '@/components/views/BiddingView';
import type { BidActionAck, JoinRoomResult, StartGameResult } from '@/shared/types';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const socket = useSocket();

  const room = useGameStore((s) => s.room);
  const sessionId = useGameStore((s) => s.sessionId);
  const yourHand = useGameStore((s) => s.yourHand);
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const me = useGameStore(selectMe);
  const [bidBusy, setBidBusy] = useState(false);

  async function handleJoin(name: string): Promise<JoinRoomResult> {
    const res = await new Promise<JoinRoomResult>((resolve) =>
      socket.emit('room:join', { code, name }, resolve)
    );
    if (res.ok) { setSession(res.sessionId); setRoom(res.room); }
    return res;
  }
  const handleStart = () => socket.emit('room:start', (res: StartGameResult) => { if (!res.ok) console.warn('Start failed:', res.error); });
  const handleSendChat = (text: string) => socket.emit('chat:send', { text });
  const handleBid = (amount: number) => {
    setBidBusy(true);
    socket.emit('bid:place', { amount }, (res: BidActionAck) => { setBidBusy(false); if (!res.ok) console.warn('Bid failed:', res.error); });
  };
  const handlePass = () => {
    setBidBusy(true);
    socket.emit('bid:pass', (res: BidActionAck) => { setBidBusy(false); if (!res.ok) console.warn('Pass failed:', res.error); });
  };

  if (!sessionId || !me) return <JoinView code={code} onSubmit={handleJoin} />;
  if (!room) return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;

  if (room.phase === 'lobby') {
    return <WaitingRoomView room={room} me={me} sessionId={sessionId} onStart={handleStart} onSendChat={handleSendChat} />;
  }
  if (room.phase === 'bidding') {
    return <BiddingView room={room} me={me} yourHand={yourHand} busy={bidBusy} onBid={handleBid} onPass={handlePass} onSendChat={handleSendChat} />;
  }
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <div className="text-gold-500 text-5xl font-serif">♛</div>
      <div className="text-2xl font-bold">Phase: <span className="text-gold-500">{room.phase}</span></div>
      <div className="text-xs text-neutral-500 mt-2">(later in this plan.)</div>
    </main>
  );
}
