import type { Card as CardType } from '@/shared/types';

interface CardProps {
  card: CardType;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_GLYPH: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SIZE_CLASSES: Record<NonNullable<CardProps['size']>, { w: string; h: string; rank: string; suit: string; center: string }> = {
  sm: { w: 'w-10', h: 'h-14', rank: 'text-xs', suit: 'text-[10px]', center: 'text-xl' },
  md: { w: 'w-14', h: 'h-20', rank: 'text-sm', suit: 'text-xs', center: 'text-2xl' },
  lg: { w: 'w-16 sm:w-[68px]', h: 'h-24', rank: 'text-base', suit: 'text-sm', center: 'text-3xl' },
};

export function Card({ card, size = 'md' }: CardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const colorClass = isRed ? 'text-cardred' : 'text-cardblack';
  const s = SIZE_CLASSES[size];
  const glyph = SUIT_GLYPH[card.suit];

  return (
    <div className={`${s.w} ${s.h} bg-white rounded-md shadow-md relative font-serif select-none ${colorClass}`}>
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
