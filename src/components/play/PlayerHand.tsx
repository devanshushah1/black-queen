'use client';
import { useState } from 'react';
import { Card } from '@/components/Card';
import type { Card as CardType } from '@/shared/types';
import { cardKey } from '@/shared/types';

interface Props {
  hand: CardType[];
  /** Which cards are legal to play right now. If null, all are legal. */
  legalKeys: Set<string> | null;
  /** When true, your turn; otherwise hand is view-only. */
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
  const maxRot = 22;
  const step = n > 1 ? (maxRot * 2) / (n - 1) : 0;

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
    <div className="relative h-32">
      <div className="flex justify-center items-end h-full">
        {sorted.map((card, i) => {
          const k = cardKey(card);
          const rot = -maxRot + step * i;
          const isStaged = stagedKey === k;
          const isLegal = !legalKeys || legalKeys.has(k);
          const dim = active && !isLegal;
          return (
            <div
              key={k}
              onClick={() => handleClick(card)}
              className={`transition-transform cursor-pointer ${active && isLegal ? 'hover:-translate-y-3' : ''} ${dim ? 'opacity-30 cursor-not-allowed' : ''}`}
              style={{
                marginLeft: i === 0 ? 0 : '-26px',
                transform: `rotate(${rot}deg) ${isStaged ? 'translateY(-32px) scale(1.1)' : ''}`,
                zIndex: isStaged ? 50 : i,
              }}
            >
              <Card card={card} size="md" />
            </div>
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
