interface Props {
  size?: 'sm' | 'md';
  rotateDeg?: number;
}

const SIZES = {
  sm: 'w-8 h-12',
  md: 'w-10 h-14',
};

export function CardBack({ size = 'sm', rotateDeg = 0 }: Props) {
  return (
    <div
      className={`${SIZES[size]} rounded shadow border border-blue-300/60`}
      style={{
        background:
          'repeating-linear-gradient(45deg, #1c3a6e 0, #1c3a6e 3px, #254a85 3px, #254a85 6px)',
        transform: `rotate(${rotateDeg}deg)`,
      }}
    />
  );
}
