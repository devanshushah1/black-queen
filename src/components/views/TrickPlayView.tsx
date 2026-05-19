'use client';
import { useEffect, useRef, useState } from 'react';
import type { RoomView, Player, Card, Seat } from '@/shared/types';
import type { PlayedCard } from '@/shared/types';
import { OpponentFan } from '@/components/play/OpponentFan';
import { PlayedCardsCenter } from '@/components/play/PlayedCardsCenter';
import { PlayerHand } from '@/components/play/PlayerHand';
import { InfoBadges } from '@/components/play/InfoBadges';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';
import { MuteToggle } from '@/components/MuteToggle';
import { cardKey } from '@/shared/types';
import { Card as CardComponent } from '@/components/Card';
import { LayoutGroup, motion } from 'framer-motion';
import { playSound } from '@/client/sounds';
import { useReducedMotion } from '@/client/useReducedMotion';

interface Props {
  room: RoomView;
  me: Player;
  yourHand: Card[];
  onPlay: (card: Card) => void;
  onSendChat: (text: string) => void;
}

function rotate(viewerSeat: Seat) {
  return {
    bottom: viewerSeat,
    left: (viewerSeat % 4) + 1,
    top: ((viewerSeat + 1) % 4) + 1,
    right: ((viewerSeat + 2) % 4) + 1,
  };
}

function seatScreenOffset(viewerSeat: Seat, seat: Seat): { x: number; y: number } {
  const diff = (seat - viewerSeat + 4) % 4;
  if (diff === 0) return { x: 0, y: 280 };   // bottom (you)
  if (diff === 1) return { x: -360, y: 0 };  // left
  if (diff === 2) return { x: 0, y: -180 };  // top
  return { x: 360, y: 0 };                   // right
}

function CollectingPile({
  plays,
  viewerSeat,
  winnerSeat,
  reduced,
}: {
  plays: PlayedCard[];
  viewerSeat: Seat;
  winnerSeat: Seat;
  reduced: boolean;
}) {
  const target = seatScreenOffset(viewerSeat, winnerSeat);
  return (
    <div className="relative w-[240px] h-[240px] mx-auto" data-testid="collecting-pile">
      {plays.map(({ card }, i) => (
        <motion.div
          key={`collect-${cardKey(card)}`}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: target.x, y: target.y, opacity: 0, scale: 0.7 }}
          transition={{ duration: reduced ? 0 : 0.5, ease: [0.2, 0.7, 0.2, 1], delay: reduced ? 0 : i * 0.02 }}
        >
          <CardComponent card={card} size="lg" />
        </motion.div>
      ))}
    </div>
  );
}

function opponentCardCount(room: RoomView, seat: Seat): number {
  const game = room.game;
  if (!game) return 0;
  let played = 0;
  for (const t of game.completedTricks) {
    if (t.plays.some((p) => p.seat === seat)) played += 1;
  }
  if (game.currentTrick) {
    if (game.currentTrick.plays.some((p) => p.seat === seat)) played += 1;
  }
  return Math.max(0, 13 - played);
}

export function TrickPlayView({ room, me, yourHand, onPlay, onSendChat }: Props) {
  const game = room.game!;
  const layout = rotate(me.seat);
  const reduced = useReducedMotion();

  const bidderSeat = game.bid.currentBidderSeat;
  const bidderName = seatNameFor(room.players, bidderSeat);
  const partnerSeat = game.revealedPartnerSeat;
  const partnerName = partnerSeat !== null ? seatNameFor(room.players, partnerSeat) : null;

  const trick = game.currentTrick;
  let nextSeat: Seat | null = null;
  if (trick) {
    nextSeat = (((trick.ledBy - 1 + trick.plays.length) % 4) + 1) as Seat;
  }
  const isMyTurn = nextSeat === me.seat;

  let legalKeys: Set<string> | null = null;
  if (isMyTurn && trick) {
    if (trick.ledSuit !== null) {
      const hasLedSuit = yourHand.some((c) => c.suit === trick.ledSuit);
      if (hasLedSuit) {
        legalKeys = new Set(yourHand.filter((c) => c.suit === trick.ledSuit).map(cardKey));
      } else {
        legalKeys = new Set(yourHand.map(cardKey));
      }
    } else {
      legalKeys = new Set(yourHand.map(cardKey));
    }
  }

  // --- Thump on each new play in the current trick ---
  const lastPlaysCount = useRef(0);
  useEffect(() => {
    const cur = trick?.plays.length ?? 0;
    if (cur > lastPlaysCount.current) {
      playSound('thump');
    }
    lastPlaysCount.current = cur;
  }, [trick?.plays.length]);

  // --- Trick collection animation state machine ---
  // The server resolves tricks immediately (CurrentTrick never has winnerSeat),
  // so we detect newly completed tricks via game.completedTricks.
  const [collectPhase, setCollectPhase] = useState<'idle' | 'pause' | 'pulse' | 'collect'>('idle');
  const [animatingTrick, setAnimatingTrick] = useState<{ plays: PlayedCard[]; winnerSeat: Seat } | null>(null);
  const lastCompletedCount = useRef<number>(game.completedTricks.length);

  useEffect(() => {
    const currentCount = game.completedTricks.length;
    if (currentCount > lastCompletedCount.current) {
      const justCompleted = game.completedTricks[currentCount - 1];
      lastCompletedCount.current = currentCount;
      setAnimatingTrick({ plays: justCompleted.plays, winnerSeat: justCompleted.winnerSeat });
      if (reduced) {
        setCollectPhase('collect');
        playSound('sweep');
        const t = setTimeout(() => {
          setCollectPhase('idle');
          setAnimatingTrick(null);
        }, 100);
        return () => clearTimeout(t);
      }
      setCollectPhase('pause');
      const t1 = setTimeout(() => setCollectPhase('pulse'), 700);
      const t2 = setTimeout(() => {
        setCollectPhase('collect');
        playSound('sweep');
      }, 700 + 400);
      const t3 = setTimeout(() => {
        setCollectPhase('idle');
        setAnimatingTrick(null);
      }, 700 + 400 + 500 + 100);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.completedTricks.length, reduced]);

  return (
    <main className="min-h-screen relative bg-[#020b08] felt-grain p-6 overflow-hidden flex flex-col justify-between">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gold-500/[0.02] rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-felt-500/[0.03] rounded-full filter blur-[150px] pointer-events-none" />

      <MuteToggle />
      <InfoBadges game={game} bidderName={bidderName} partnerName={partnerName} />

      <LayoutGroup>
        {/* Card Table Area */}
        <div className="relative max-w-4xl w-full mx-auto mt-6 h-[400px] flex items-center justify-center">
          
          {/* Luxury Mahogany Wood Oval Mat Backdrop */}
          <div className="absolute w-[94%] h-[92%] rounded-[120px] border-[10px] border-double border-[#2a170d] bg-gradient-to-b from-[#0c5537] via-[#073523] to-[#03140e] shadow-[inset_0_12px_24px_rgba(0,0,0,0.7),0_20px_40px_rgba(0,0,0,0.9)] felt-grain pointer-events-none">
            {/* Subtle center spotlight gold ring */}
            <div className="absolute inset-8 rounded-[90px] border border-gold-500/10 pointer-events-none" />
            
            {/* Subtle table center crest */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
              <svg className="w-48 h-48 text-gold-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C9 6.5 5.5 8.5 5.5 11.5c0 2.8 2.2 4.5 4.5 4.5.34 0 .67-.04.99-.11l-.49 2.94A1.5 1.5 0 0012 20.25a1.5 1.5 0 001.5-1.42l-.49-2.94c.32.07.65.11.99.11a4.5 4.5 0 004.5-4.5c0-3-3.5-5-6-9.5z" />
              </svg>
            </div>
          </div>

          {/* Top Opponent (North) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-center z-20 transition-all duration-300">
            <OpponentFan count={opponentCardCount(room, layout.top as Seat)} orientation="top" />
            <div className="mt-1.5 flex flex-col items-center">
              <div className="text-xs font-extrabold text-white/90 px-3 py-0.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 shadow-sm flex items-center gap-1.5">
                {nextSeat === layout.top && (
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-ping" />
                )}
                {seatNameFor(room.players, layout.top)}
              </div>
              {nextSeat === layout.top && (
                <div className="text-[9px] uppercase tracking-widest text-gold-400 font-extrabold mt-0.5 animate-pulse">thinking…</div>
              )}
            </div>
          </div>

          {/* Left Opponent (West) */}
          <div className="absolute top-1/2 left-3 -translate-y-1/2 text-center z-20 transition-all duration-300">
            <OpponentFan count={opponentCardCount(room, layout.left as Seat)} orientation="left" />
            <div className="mt-2 flex flex-col items-center">
              <div className="text-xs font-extrabold text-white/90 px-3 py-0.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 shadow-sm flex items-center gap-1.5">
                {nextSeat === layout.left && (
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-ping" />
                )}
                {seatNameFor(room.players, layout.left)}
              </div>
              {nextSeat === layout.left && (
                <div className="text-[9px] uppercase tracking-widest text-gold-400 font-extrabold mt-0.5 animate-pulse">thinking…</div>
              )}
            </div>
          </div>

          {/* Right Opponent (East) */}
          <div className="absolute top-1/2 right-3 -translate-y-1/2 text-center z-20 transition-all duration-300">
            <OpponentFan count={opponentCardCount(room, layout.right as Seat)} orientation="right" />
            <div className="mt-2 flex flex-col items-center">
              <div className="text-xs font-extrabold text-white/90 px-3 py-0.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10 shadow-sm flex items-center gap-1.5">
                {nextSeat === layout.right && (
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-ping" />
                )}
                {seatNameFor(room.players, layout.right)}
              </div>
              {nextSeat === layout.right && (
                <div className="text-[9px] uppercase tracking-widest text-gold-400 font-extrabold mt-0.5 animate-pulse">thinking…</div>
              )}
            </div>
          </div>

          {/* Played Cards Center Mat */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            {animatingTrick && collectPhase !== 'collect' && (
              <PlayedCardsCenter
                plays={animatingTrick.plays}
                viewerSeat={me.seat}
                winningSeat={collectPhase === 'pulse' ? animatingTrick.winnerSeat : null}
              />
            )}
            {animatingTrick && collectPhase === 'collect' && (
              <CollectingPile plays={animatingTrick.plays} viewerSeat={me.seat} winnerSeat={animatingTrick.winnerSeat} reduced={reduced} />
            )}
            {!animatingTrick && trick && (
              <PlayedCardsCenter plays={trick.plays} viewerSeat={me.seat} />
            )}
          </div>
        </div>

        {/* Player Controls & Hand Area */}
        <div className="max-w-4xl w-full mx-auto mt-4 z-20 select-none">
          <div className="text-[10px] uppercase tracking-widest text-neutral-400 text-center mb-2 font-extrabold">
            {isMyTurn ? (
              <span className="text-gold-400 flex items-center justify-center gap-1.5 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                Your turn
              </span>
            ) : (
              'Waiting…'
            )}
          </div>
          <PlayerHand hand={yourHand} legalKeys={legalKeys} active={isMyTurn} onPlay={onPlay} />
          
          <div className="text-center mt-3">
            <span className="inline-block text-sm font-extrabold text-white/95 px-4 py-1 rounded-full bg-gold-500/[0.08] border border-gold-500/30 shadow-glass-gold">
              {me.name} (You)
            </span>
          </div>
        </div>
      </LayoutGroup>

      {/* Glassmorphic Floating Chat Widget */}
      <div className="fixed bottom-4 right-4 z-40">
        <ChatPanel messages={room.chat} onSend={onSendChat} />
      </div>
    </main>
  );
}
