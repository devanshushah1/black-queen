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

function positionFor(viewerSeat: Seat, seat: Seat): 'top' | 'left' | 'right' | 'bottom' {
  const diff = (seat - viewerSeat + 4) % 4;
  if (diff === 0) return 'bottom';
  if (diff === 1) return 'left';
  if (diff === 2) return 'top';
  return 'right';
}

const POSITION_STYLE: Record<string, React.CSSProperties> = {
  top:    { top: 0,    left: '50%', transform: 'translateX(-50%)' },
  left:   { left: 0,   top: '50%',  transform: 'translateY(-50%)' },
  right:  { right: 0,  top: '50%',  transform: 'translateY(-50%)' },
  bottom: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
};

export function PlayedCardsCenter({ plays, viewerSeat, winningSeat = null }: Props) {
  return (
    <div className="relative w-[240px] h-[240px] mx-auto" data-testid="played-cards">
      {plays.map(({ seat, card }) => {
        const pos = positionFor(viewerSeat, seat);
        const isWinner = winningSeat === seat;
        return (
          <motion.div
            key={`${seat}-${cardKey(card)}`}
            layoutId={`card-${cardKey(card)}`}
            className="absolute"
            style={POSITION_STYLE[pos]}
            animate={
              isWinner
                ? {
                    scale: [1, 1.18, 1.05],
                    boxShadow: [
                      '0 4px 8px rgba(0,0,0,0.4)',
                      '0 0 18px 4px #d4a437',
                      '0 0 0px 0px rgba(212,164,55,0)',
                    ],
                  }
                : { scale: 1 }
            }
            transition={isWinner ? { duration: 0.4 } : { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            data-testid={`played-card-${pos}`}
          >
            <Card card={card} size="lg" />
          </motion.div>
        );
      })}
    </div>
  );
}
