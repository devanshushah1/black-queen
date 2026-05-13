type Variant = 'live' | 'bid' | 'passed' | 'bidder';

interface StatusPillProps {
  variant: Variant;
  label: string;
  pulse?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  live:    'bg-blue-400/20 text-blue-300 border border-blue-400/40',
  bid:     'bg-gold-500 text-black font-bold',
  passed:  'bg-white/5 text-neutral-400 border border-white/10',
  bidder:  'bg-gold-500/20 text-gold-500 border border-gold-500/40 font-semibold',
};

export function StatusPill({ variant, label, pulse }: StatusPillProps) {
  return (
    <span
      className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${VARIANT_CLASSES[variant]} ${pulse ? 'animate-pulse' : ''}`}
    >
      {label}
    </span>
  );
}
