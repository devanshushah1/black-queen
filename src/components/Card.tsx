import type { Card as CardType } from '@/shared/types';

interface CardProps {
  card: CardType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** True when this card is illegal on the current turn and must be visually dimmed. */
  dim?: boolean;
}

const SUIT_SVGS: Record<string, React.ReactNode> = {
  hearts: (
    <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ),
  diamonds: (
    <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
      <path d="M12 2L2 12l10 10 10-10L12 2z"/>
    </svg>
  ),
  clubs: (
    <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
      <path d="M12 2a3 3 0 00-3 3c0 .58.16 1.12.45 1.58A4 4 0 006.5 10.5 4 4 0 0010.5 14.5c.29 0 .57-.03.85-.09l-.42 2.51a1.29 1.29 0 002.57 0l-.42-2.51c.28.06.56.09.85.09a4 4 0 004-4 4 4 0 00-2.95-3.92c.29-.46.45-1 .45-1.58a3 3 0 00-3-3z"/>
    </svg>
  ),
  spades: (
    <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
      <path d="M12 2C9 6 6 8 6 11c0 2.5 2 4 4 4c.3 0 .6-.04.9-.1l-.44 2.6a1.3 1.3 0 002.6 0l-.44-2.6c.3.06.6.1.9.1a4 4 0 004-4c0-3-3-5-6-9z"/>
    </svg>
  ),
};

const SIZE_CLASSES: Record<NonNullable<CardProps['size']>, { w: string; h: string; rank: string; suit: string; center: string }> = {
  sm: { w: 'w-10',          h: 'h-14',         rank: 'text-xs',  suit: 'w-2 h-2',     center: 'w-4 h-4' },
  md: { w: 'w-14',          h: 'h-20',         rank: 'text-sm',  suit: 'w-3 h-3',     center: 'w-6 h-6' },
  lg: { w: 'w-20',          h: 'h-28',         rank: 'text-base',suit: 'w-4 h-4',     center: 'w-10 h-10' },
  xl: { w: 'w-[88px]',      h: 'h-[124px]',    rank: 'text-lg',  suit: 'w-[18px] h-[18px]', center: 'w-14 h-14' },
};

export function Card({ card, size = 'md', dim = false }: CardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const isBlackQueen = card.suit === 'spades' && card.rank === 'Q';
  
  let colorClass = isRed ? 'text-cardred' : 'text-cardblack';
  if (isBlackQueen) colorClass = 'text-gold-600';

  const s = SIZE_CLASSES[size];
  const svgGlyph = SUIT_SVGS[card.suit];
  const dimClass = dim ? 'opacity-40 grayscale-[20%]' : '';

  // Background styling
  const bgClass = isBlackQueen 
    ? 'bg-[#fafaf5] bg-gradient-to-br from-[#fafaf5] via-[#fffbf0] to-[#fce38a]/30 border-2 border-gold-500 shadow-card-hover' 
    : 'bg-[#fafaf5] border border-black/10 shadow-card-rest';

  return (
    <div
      className={`${s.w} ${s.h} ${bgClass} rounded-md relative font-serif select-none ${colorClass} ${dimClass} transition-all duration-300`}
    >
      {/* Decorative fine double border inside card face */}
      <div className="absolute inset-1 border border-black/[0.04] rounded-md pointer-events-none" />
      {isBlackQueen && (
        <div className="absolute inset-0.5 border border-gold-500/20 rounded-md pointer-events-none animate-pulse-slow" />
      )}

      {/* Top Left Index */}
      <div className={`absolute top-1 left-1.5 flex flex-col items-center leading-none`}>
        <span className={`${s.rank} font-extrabold tracking-tighter`}>{card.rank}</span>
        <span className={`block mt-0.5 ${s.suit}`}>{svgGlyph}</span>
      </div>

      {/* Center Art */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
        <div className={s.center}>
          {isBlackQueen ? (
            /* Ornate golden crown for the Black Queen */
            <svg className="w-full h-full fill-current text-gold-500 filter drop-shadow-md animate-pulse-slow" viewBox="0 0 24 24">
              <path d="M5 16L3 5l5 5 4-7 4 7 5-5-2 11H5zm14 2H5v2h14v-2z"/>
            </svg>
          ) : (
            svgGlyph
          )}
        </div>
      </div>

      {/* Bottom Right Index (Inverted) */}
      <div className={`absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180`}>
        <span className={`${s.rank} font-extrabold tracking-tighter`}>{card.rank}</span>
        <span className={`block mt-0.5 ${s.suit}`}>{svgGlyph}</span>
      </div>
    </div>
  );
}
