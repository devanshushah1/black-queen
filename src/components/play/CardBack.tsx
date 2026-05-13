interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<CardBackProps['size']>, { w: string; h: string }> = {
  sm: { w: 'w-8',          h: 'h-12' },
  md: { w: 'w-[44px]',     h: 'h-[62px]' },    // opponent backs (spec)
  lg: { w: 'w-[88px]',     h: 'h-[124px]' },   // deck stack (spec)
};

export function CardBack({ size = 'sm' }: CardBackProps) {
  const s = SIZE_CLASSES[size];
  return (
    <div
      className={`${s.w} ${s.h} rounded-md shadow-card-rest border border-blue-700/60`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, #1e3a5f 0px, #1e3a5f 6px, #2c4870 6px, #2c4870 12px)',
      }}
    />
  );
}
