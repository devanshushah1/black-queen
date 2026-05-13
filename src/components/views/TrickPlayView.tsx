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
}: {
  plays: PlayedCard[];
  viewerSeat: Seat;
  winnerSeat: Seat;
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
          transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1], delay: i * 0.02 }}
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
  }, [game.completedTricks.length]);

  return (
    <main className="min-h-screen relative bg-felt-900 p-6">
      <MuteToggle />
      <InfoBadges game={game} bidderName={bidderName} partnerName={partnerName} />

      <LayoutGroup>
        <div className="relative max-w-4xl mx-auto mt-6 h-[380px]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
            <OpponentFan count={opponentCardCount(room, layout.top as Seat)} orientation="top" />
            <div className="text-xs font-semibold text-white mt-1">{seatNameFor(room.players, layout.top)}</div>
            {nextSeat === layout.top && <div className="text-[10px] text-gold-500 animate-pulse">thinking…</div>}
          </div>
          <div className="absolute top-1/2 left-2 -translate-y-1/2 text-center">
            <OpponentFan count={opponentCardCount(room, layout.left as Seat)} orientation="left" />
            <div className="text-xs font-semibold text-white mt-1">{seatNameFor(room.players, layout.left)}</div>
            {nextSeat === layout.left && <div className="text-[10px] text-gold-500 animate-pulse">thinking…</div>}
          </div>
          <div className="absolute top-1/2 right-2 -translate-y-1/2 text-center">
            <OpponentFan count={opponentCardCount(room, layout.right as Seat)} orientation="right" />
            <div className="text-xs font-semibold text-white mt-1">{seatNameFor(room.players, layout.right)}</div>
            {nextSeat === layout.right && <div className="text-[10px] text-gold-500 animate-pulse">thinking…</div>}
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            {animatingTrick && collectPhase !== 'collect' && (
              <PlayedCardsCenter
                plays={animatingTrick.plays}
                viewerSeat={me.seat}
                winningSeat={collectPhase === 'pulse' ? animatingTrick.winnerSeat : null}
              />
            )}
            {animatingTrick && collectPhase === 'collect' && (
              <CollectingPile plays={animatingTrick.plays} viewerSeat={me.seat} winnerSeat={animatingTrick.winnerSeat} />
            )}
            {!animatingTrick && trick && (
              <PlayedCardsCenter plays={trick.plays} viewerSeat={me.seat} />
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-4">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500 text-center mb-1">
            {isMyTurn ? <span className="text-gold-500">Your turn</span> : 'Waiting…'}
          </div>
          <PlayerHand hand={yourHand} legalKeys={legalKeys} active={isMyTurn} onPlay={onPlay} />
          <div className="text-center mt-2 text-xs text-white font-semibold">{me.name} (you)</div>
        </div>
      </LayoutGroup>

      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
