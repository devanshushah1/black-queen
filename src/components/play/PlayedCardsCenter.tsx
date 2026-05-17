'use client';
import { motion } from 'framer-motion';
import { Card } from '@/components/Card';
import { cardKey } from '@/shared/types';
import type { PlayedCard, Seat } from '@/shared/types';

interface Props {
  plays: PlayedCard[];
  viewerSeat: Seat;
  /** When set, the card from this seat is currently the winner and pulses gold. */
  winningSeat?: Seat | null;
}

type Pos = 'top' | 'left' | 'right' | 'bottom';

function positionFor(viewerSeat: Seat, seat: Seat): Pos {
  const diff = (seat - viewerSeat + 4) % 4;
  if (diff === 0) return 'bottom';
  if (diff === 1) return 'left';
  if (diff === 2) return 'top';
  return 'right';
}

/** Tossed-pile offsets from container center, plus per-seat tilt. */
const POSITION_TRANSFORM: Record<Pos, { x: number; y: number; rotate: number }> = {
  top:    { x: 0,    y: -22,  rotate: -2 },
  right:  { x: 22,   y: 0,    rotate: 10 },
  bottom: { x: 0,    y: 22,   rotate: 2 },
  left:   { x: -22,  y: 0,    rotate: -12 },
};

export function PlayedCardsCenter({ plays, viewerSeat, winningSeat = null }: Props) {
  return (
    <div className="relative w-[160px] h-[160px] mx-auto" data-testid="played-cards">
      {plays.map(({ seat, card }, i) => {
        const pos = positionFor(viewerSeat, seat);
        const t = POSITION_TRANSFORM[pos];
        const isWinner = winningSeat === seat;
        return (
          <motion.div
            key={`${seat}-${cardKey(card)}`}
            layoutId={`card-${cardKey(card)}`}
            className="absolute top-1/2 left-1/2"
            style={{ zIndex: 10 + i }}
            initial={false}
            animate={
              isWinner
                ? {
                    x: t.x - 28, // -28 ≈ -56/2 to center the md card (width 56)
                    y: t.y - 40, // -40 ≈ -80/2 to center the md card (height 80)
                    rotate: t.rotate,
                    scale: [1, 1.18, 1.05],
                    boxShadow: [
                      '0 4px 8px rgba(0,0,0,0.4)',
                      '0 0 18px 4px #d4a437',
                      '0 0 0px 0px rgba(212,164,55,0)',
                    ],
                  }
                : {
                    x: t.x - 28,
                    y: t.y - 40,
                    rotate: t.rotate,
                    scale: 1,
                  }
            }
            transition={isWinner ? { duration: 0.4 } : { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            data-testid={`played-card-${pos}`}
          >
            <Card card={card} size="md" />
          </motion.div>
        );
      })}
    </div>
  );
}
