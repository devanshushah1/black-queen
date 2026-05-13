import type { Card, Suit } from '@/shared/types';
import { pointValue } from '@/shared/types';

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

interface Props {
  cards: Card[];
}

/** Renders one chip per point-card (5/10/A/Q♠); 0-point cards are omitted. */
export function ChipRow({ cards }: Props) {
  const points = cards.filter((c) => pointValue(c) > 0);
  if (points.length === 0) return <div className="text-[10px] text-neutral-500 italic">no point cards</div>;

  return (
    <div className="flex flex-wrap gap-1">
      {points.map((card, i) => {
        const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
        const isQoS = card.suit === 'spades' && card.rank === 'Q';
        const pts = pointValue(card);
        return (
          <span
            key={i}
            className={isQoS
              ? 'inline-flex items-center bg-amber-100 text-black text-[11px] font-bold font-serif px-1.5 py-0.5 rounded border border-amber-400 gap-1'
              : `inline-flex items-center bg-white text-[11px] font-bold font-serif px-1.5 py-0.5 rounded gap-1 ${isRed ? 'text-cardred' : 'text-cardblack'}`}
          >
            {card.rank}{SUIT_GLYPH[card.suit]}
            <span className="bg-gold-500/30 text-[9px] px-1 rounded text-amber-900 font-sans">+{pts}</span>
          </span>
        );
      })}
    </div>
  );
}
