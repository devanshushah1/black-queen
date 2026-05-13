import { CardBack } from './CardBack';

interface Props {
  count: number;
  orientation: 'top' | 'left' | 'right';
}

export function OpponentFan({ count, orientation }: Props) {
  if (count <= 0) return null;

  if (orientation === 'top') {
    return <OpponentFanHorizontal count={count} />;
  }
  return <OpponentFanVertical count={count} side={orientation} />;
}

function OpponentFanHorizontal({ count }: { count: number }) {
  const cards = Array.from({ length: count });
  const maxRot = 11;                                  // ~22° total spread
  const step = count > 1 ? (maxRot * 2) / (count - 1) : 0;
  return (
    <div className="relative w-[260px] h-[80px]" data-testid="opponent-fan-top">
      {cards.map((_, i) => {
        const rot = -maxRot + step * i;
        const offsetX = (i - (count - 1) / 2) * 12;   // overlap step
        return (
          <div
            key={i}
            className="absolute left-1/2 top-0"
            style={{
              transform: `translateX(${offsetX - 22}px) rotate(${rot}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <CardBack size="md" />
          </div>
        );
      })}
    </div>
  );
}

function OpponentFanVertical({ count, side }: { count: number; side: 'left' | 'right' }) {
  const cards = Array.from({ length: count });
  const maxRot = 11;                                  // ~22° spread
  const step = count > 1 ? (maxRot * 2) / (count - 1) : 0;
  // baseRot rotates the whole card 90° so its long edge runs vertical.
  // Then per-card delta bows outward (positive on right side, negative on left).
  const baseRot = side === 'left' ? 90 : -90;
  const direction = side === 'left' ? 1 : -1;
  return (
    <div
      className="relative w-[80px] h-[260px]"
      data-testid={`opponent-fan-${side}`}
    >
      {cards.map((_, i) => {
        const delta = -maxRot + step * i;
        const rot = baseRot + delta * direction;
        const offsetY = (i - (count - 1) / 2) * 12;   // overlap step along the side
        return (
          <div
            key={i}
            className="absolute left-0 top-1/2"
            style={{
              transform: `translateY(${offsetY - 31}px) rotate(${rot}deg)`,
              transformOrigin: side === 'left' ? 'left center' : 'right center',
            }}
          >
            <CardBack size="md" />
          </div>
        );
      })}
    </div>
  );
}
