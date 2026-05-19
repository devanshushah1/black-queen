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
      className={`${s.w} ${s.h} rounded-lg shadow-card-rest bg-gradient-to-br from-[#1a2e4c] via-[#0d1b2a] to-[#070f17] border-2 border-gold-600/60 relative overflow-hidden transition-all duration-300`}
    >
      {/* Intricate Gold Filigree Inner Frame */}
      <div className="absolute inset-1 border border-gold-400/20 rounded-md pointer-events-none" />
      
      {/* Geometric background patterns */}
      <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #ffebad 1px, transparent 0)',
        backgroundSize: '8px 8px'
      }} />

      {/* Ornate Spade Crown Centerpiece */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg className="w-1/2 h-1/2 text-gold-500/80 filter drop-shadow" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C9 6.5 5.5 8.5 5.5 11.5c0 2.8 2.2 4.5 4.5 4.5.34 0 .67-.04.99-.11l-.49 2.94A1.5 1.5 0 0012 20.25a1.5 1.5 0 001.5-1.42l-.49-2.94c.32.07.65.11.99.11a4.5 4.5 0 004.5-4.5c0-3-3.5-5-6-9.5z" />
          <path d="M9.5 7h5v1.5h-5z" fill="#0d1b2a" opacity="0.3" />
        </svg>
      </div>
    </div>
  );
}
