'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { selectMe, useGameStore } from '@/client/store';
import { JoinView } from '@/components/views/JoinView';
import { WaitingRoomView } from '@/components/views/WaitingRoomView';
import { BiddingView } from '@/components/views/BiddingView';
import { TrumpPartnerView } from '@/components/views/TrumpPartnerView';
import { TrickPlayView } from '@/components/views/TrickPlayView';
import { EndView } from '@/components/views/EndView';
import type {
  BidActionAck,
  JoinRoomResult,
  StartGameResult,
  TrumpPartnerActionAck,
  PlayCardAck,
  PlayAgainAck,
  Suit,
  Card,
} from '@/shared/types';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const router = useRouter();
  const socket = useSocket();

  const room = useGameStore((s) => s.room);
  const sessionId = useGameStore((s) => s.sessionId);
  const yourHand = useGameStore((s) => s.yourHand);
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const reset = useGameStore((s) => s.reset);
  const me = useGameStore(selectMe);
  const [bidBusy, setBidBusy] = useState(false);
  const [tpBusy, setTpBusy] = useState(false);

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
  const handleTpConfirm = (trump: Suit, called: Card) => {
    setTpBusy(true);
    socket.emit('trump:choose', { trump, calledCard: called }, (res: TrumpPartnerActionAck) => {
      setTpBusy(false);
      if (!res.ok) console.warn('Trump-partner failed:', res.error);
    });
  };
  const handleCardPlay = (card: Card) => {
    socket.emit('card:play', { card }, (res: PlayCardAck) => {
      if (!res.ok) console.warn('Play failed:', res.error);
    });
  };
  const handlePlayAgain = () => {
    socket.emit('room:play-again', (res: PlayAgainAck) => {
      if (!res.ok) console.warn('Play again failed:', res.error);
    });
  };
  const handleLeave = () => {
    socket.emit('room:leave');
    reset();
    router.push('/');
  };

  if (!sessionId || !me) return <JoinView code={code} onSubmit={handleJoin} />;
  if (!room) return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;

  if (room.phase === 'lobby') {
    return <WaitingRoomView room={room} me={me} sessionId={sessionId} onStart={handleStart} onSendChat={handleSendChat} />;
  }
  if (room.phase === 'bidding') {
    return <BiddingView room={room} me={me} yourHand={yourHand} busy={bidBusy} onBid={handleBid} onPass={handlePass} onSendChat={handleSendChat} />;
  }
  if (room.phase === 'trump_partner') {
    return <TrumpPartnerView room={room} me={me} yourHand={yourHand} busy={tpBusy} onConfirm={handleTpConfirm} onSendChat={handleSendChat} />;
  }
  if (room.phase === 'play') {
    return <TrickPlayView room={room} me={me} yourHand={yourHand} onPlay={handleCardPlay} onSendChat={handleSendChat} />;
  }
  if (room.phase === 'end') {
    return <EndView room={room} me={me} sessionId={sessionId} onPlayAgain={handlePlayAgain} onLeave={handleLeave} onSendChat={handleSendChat} />;
  }
  return <main className="min-h-screen flex items-center justify-center text-neutral-500">Unknown phase: {room.phase}</main>;
}
