import { Card } from '@/components/Card';
import type { PlayedCard, Seat } from '@/shared/types';

interface Props {
  plays: PlayedCard[];
  viewerSeat: Seat;
}

function positionFor(viewerSeat: Seat, seat: Seat): 'top' | 'left' | 'right' | 'bottom' {
  const diff = (seat - viewerSeat + 4) % 4;
  if (diff === 0) return 'bottom';
  if (diff === 1) return 'left';
  if (diff === 2) return 'top';
  return 'right';
}

const POSITION_STYLE: Record<string, React.CSSProperties> = {
  top:    { top: 0, left: '50%', transform: 'translateX(-50%)' },
  left:   { left: 0, top: '50%', transform: 'translateY(-50%)' },
  right:  { right: 0, top: '50%', transform: 'translateY(-50%)' },
  bottom: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
};

export function PlayedCardsCenter({ plays, viewerSeat }: Props) {
  return (
    <div className="relative w-[180px] h-[180px] mx-auto">
      {plays.map(({ seat, card }) => {
        const pos = positionFor(viewerSeat, seat);
        return (
          <div key={`${seat}-${card.suit}-${card.rank}`} className="absolute" style={POSITION_STYLE[pos]}>
            <Card card={card} size="md" />
          </div>
        );
      })}
    </div>
  );
}
