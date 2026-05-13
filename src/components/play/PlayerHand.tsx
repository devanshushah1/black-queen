'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/Card';
import type { Card as CardType } from '@/shared/types';
import { cardKey } from '@/shared/types';

interface Props {
  hand: CardType[];
  legalKeys: Set<string> | null;
  active: boolean;
  onPlay: (card: CardType) => void;
}

const SUIT_ORDER = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

function sortHand(hand: CardType[]): CardType[] {
  return [...hand].sort((a, b) => {
    const s = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (s !== 0) return s;
    return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  });
}

export function PlayerHand({ hand, legalKeys, active, onPlay }: Props) {
  const sorted = sortHand(hand);
  const [stagedKey, setStagedKey] = useState<string | null>(null);
  const n = sorted.length;
  const maxRot = 18;                       // ~36° total spread
  const step = n > 1 ? (maxRot * 2) / (n - 1) : 0;
  const overlap = 38;                      // px overlap between adjacent cards

  function handleClick(card: CardType) {
    if (!active) return;
    const k = cardKey(card);
    if (legalKeys && !legalKeys.has(k)) return;
    if (stagedKey === k) {
      onPlay(card);
      setStagedKey(null);
      return;
    }
    setStagedKey(k);
  }

  return (
    <div className="relative h-44">
      <div className="flex justify-center items-end h-full">
        {sorted.map((card, i) => {
          const k = cardKey(card);
          const rot = -maxRot + step * i;
          const isStaged = stagedKey === k;
          const isLegal = !legalKeys || legalKeys.has(k);
          const dim = active && !isLegal;
          const isHoverable = active && isLegal;

          return (
            <motion.div
              key={k}
              layoutId={`card-${k}`}
              onClick={() => handleClick(card)}
              className={`${isHoverable ? 'cursor-pointer' : ''} ${dim ? 'cursor-not-allowed' : ''}`}
              style={{
                marginLeft: i === 0 ? 0 : `-${overlap}px`,
                zIndex: isStaged ? 50 : i,
                transformOrigin: 'bottom center',
              }}
              initial={false}
              animate={{
                rotate: rot,
                y: isStaged ? -60 : 0,
                scale: isStaged ? 1.05 : 1,
              }}
              whileHover={isHoverable && !isStaged ? { y: -12 } : undefined}
              transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <Card card={card} size="xl" dim={dim} />
            </motion.div>
          );
        })}
      </div>
      {stagedKey && active && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 text-[11px] bg-gold-500 text-black font-bold px-3 py-1 rounded shadow">
          Click again to play
        </div>
      )}
    </div>
  );
}
