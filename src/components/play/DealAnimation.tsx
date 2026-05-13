'use client';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CardBack } from './CardBack';
import type { Seat } from '@/shared/types';
import { playSound } from '@/client/sounds';

interface Props {
  viewerSeat: Seat;
  onDone: () => void;
}

/** Each entry: which seat receives card i, in deal order (0..51). N=top, E=right, S=bottom, W=left from viewer. */
function buildDealOrder(viewerSeat: Seat): Array<'top' | 'right' | 'bottom' | 'left'> {
  function pos(seat: Seat): 'top' | 'right' | 'bottom' | 'left' {
    const diff = (seat - viewerSeat + 4) % 4;
    if (diff === 0) return 'bottom';
    if (diff === 1) return 'left';
    if (diff === 2) return 'top';
    return 'right';
  }
  const out: Array<'top' | 'right' | 'bottom' | 'left'> = [];
  for (let i = 0; i < 52; i++) {
    const seat = ((i % 4) + 1) as Seat;
    out.push(pos(seat));
  }
  return out;
}

const TARGET_OFFSET: Record<'top' | 'right' | 'bottom' | 'left', { x: number; y: number; rotate: number }> = {
  top:    { x: 0,    y: -180, rotate: 180 },
  right:  { x: 360,  y: 0,    rotate: -90 },
  bottom: { x: 0,    y: 180,  rotate: 0 },
  left:   { x: -360, y: 0,    rotate: 90 },
};

const PER_CARD_DELAY = 0.04;        // 40 ms — clockwise dealer cadence
const FLIGHT_DURATION = 0.32;       // each card's flight time
const TOTAL_DURATION_MS = 2100 + 600; // deal + flip ripple + small settle

export function DealAnimation({ viewerSeat, onDone }: Props) {
  const order = buildDealOrder(viewerSeat);

  useEffect(() => {
    playSound('shuffle');
    const whips: number[] = [];
    for (let i = 0; i < 52; i++) {
      whips.push(window.setTimeout(() => playSound('whip'), i * PER_CARD_DELAY * 1000));
    }
    const t = setTimeout(onDone, TOTAL_DURATION_MS);
    return () => {
      clearTimeout(t);
      whips.forEach((id) => clearTimeout(id));
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
      data-testid="deal-animation"
    >
      {/* Deck stack at center */}
      <div className="absolute" style={{ transform: 'translate(-2px,-2px)', opacity: 0.7 }}>
        <CardBack size="lg" />
      </div>
      <div className="absolute" style={{ transform: 'translate(0,0)', opacity: 0.85 }}>
        <CardBack size="lg" />
      </div>
      <div className="absolute" style={{ transform: 'translate(2px,2px)' }}>
        <CardBack size="lg" />
      </div>

      {/* 52 flying cards. Each starts at deck center and animates to a seat. */}
      {order.map((pos, i) => {
        const target = TARGET_OFFSET[pos];
        return (
          <motion.div
            key={i}
            className="absolute"
            initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
            animate={{
              x: target.x,
              y: target.y,
              rotate: target.rotate,
              opacity: [0, 1, 1, 1],
            }}
            transition={{
              delay: i * PER_CARD_DELAY,
              duration: FLIGHT_DURATION,
              ease: [0.2, 0.7, 0.2, 1],
              times: [0, 0.15, 0.85, 1],
            }}
          >
            <CardBack size="md" />
          </motion.div>
        );
      })}
    </div>
  );
}
