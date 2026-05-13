import { CardBack } from './CardBack';

interface Props {
  /** Number of cards in the opponent's hand. */
  count: number;
  /** 'top' fans down, 'left' fans right (rotated), 'right' fans left (rotated). */
  orientation: 'top' | 'left' | 'right';
}

export function OpponentFan({ count, orientation }: Props) {
  if (count <= 0) return null;
  const cards = Array.from({ length: count });

  if (orientation === 'top') {
    const spread = Math.min(2, 18 / Math.max(count - 1, 1));
    return (
      <div className="flex justify-center items-end">
        {cards.map((_, i) => {
          const offsetFromCenter = i - (count - 1) / 2;
          const rot = offsetFromCenter * spread;
          return (
            <div key={i} style={{ marginLeft: i === 0 ? 0 : '-12px', transform: `rotate(${rot}deg)`, transformOrigin: 'bottom center' }}>
              <CardBack size="sm" />
            </div>
          );
        })}
      </div>
    );
  }

  const baseRot = orientation === 'left' ? 90 : -90;
  return (
    <div className="flex flex-col justify-center items-center">
      {cards.map((_, i) => (
        <div key={i} style={{ marginTop: i === 0 ? 0 : '-10px', transform: `rotate(${baseRot}deg)` }}>
          <CardBack size="sm" />
        </div>
      ))}
    </div>
  );
}
