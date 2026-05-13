import { Card } from '@/components/Card';
import type { Card as CardType } from '@/shared/types';

interface HandPreviewProps {
  hand: CardType[];
}

const SUIT_ORDER = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

function sortHand(hand: CardType[]): CardType[] {
  return [...hand].sort((a, b) => {
    const s = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (s !== 0) return s;
    return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  });
}

export function HandPreview({ hand }: HandPreviewProps) {
  const sorted = sortHand(hand);
  return (
    <div className="flex justify-center items-end">
      {sorted.map((card, i) => (
        <div
          key={i}
          className="transition-transform hover:-translate-y-2"
          style={{ marginLeft: i === 0 ? 0 : '-22px' }}
        >
          <Card card={card} size="sm" />
        </div>
      ))}
    </div>
  );
}
