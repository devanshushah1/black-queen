import type { Card as CardType } from '@/shared/types';

interface CardProps {
  card: CardType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** True when this card is illegal on the current turn and must be visually dimmed. */
  dim?: boolean;
}

const SUIT_GLYPH: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

// xl is the "comfortable" player-hand size from the spec (88 × 124 ≈ w-22 h-31 -> w-[88px] h-[124px]).
// lg is the new center-played slot (80 × 112).
// md and sm are kept for HandPreview and small contexts.
const SIZE_CLASSES: Record<NonNullable<CardProps['size']>, { w: string; h: string; rank: string; suit: string; center: string }> = {
  sm: { w: 'w-10',          h: 'h-14',         rank: 'text-xs',  suit: 'text-[10px]', center: 'text-xl' },
  md: { w: 'w-14',          h: 'h-20',         rank: 'text-sm',  suit: 'text-xs',     center: 'text-2xl' },
  lg: { w: 'w-20',          h: 'h-28',         rank: 'text-base',suit: 'text-sm',     center: 'text-3xl' },
  xl: { w: 'w-[88px]',      h: 'h-[124px]',    rank: 'text-lg',  suit: 'text-base',   center: 'text-4xl' },
};

export function Card({ card, size = 'md', dim = false }: CardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const colorClass = isRed ? 'text-cardred' : 'text-cardblack';
  const s = SIZE_CLASSES[size];
  const glyph = SUIT_GLYPH[card.suit];
  const dimClass = dim ? 'opacity-50' : '';

  return (
    <div
      className={`${s.w} ${s.h} bg-[#fafaf5] rounded-md shadow-card-rest relative font-serif select-none ${colorClass} ${dimClass}`}
    >
      <div className={`absolute top-1 left-1.5 ${s.rank} font-bold leading-none`}>
        {card.rank}
        <span className={`block ${s.suit}`}>{glyph}</span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center ${s.center}`}>{glyph}</div>
      <div className={`absolute bottom-1 right-1.5 ${s.rank} font-bold leading-none rotate-180`}>
        {card.rank}
        <span className={`block ${s.suit}`}>{glyph}</span>
      </div>
    </div>
  );
}
