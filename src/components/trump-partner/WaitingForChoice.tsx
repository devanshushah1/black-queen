interface Props {
  bidderName: string;
}

export function WaitingForChoice({ bidderName }: Props) {
  return (
    <div className="bg-black/80 border border-white/15 rounded-2xl p-6 text-center">
      <div className="text-gold-500 font-bold text-lg">{bidderName} is choosing</div>
      <div className="text-sm text-neutral-300 mt-1">Trump suit and partner card</div>
      <div className="flex gap-1.5 justify-center mt-3">
        <span className="w-2 h-2 bg-gold-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gold-500 rounded-full animate-pulse" style={{ animationDelay: '180ms' }} />
        <span className="w-2 h-2 bg-gold-500 rounded-full animate-pulse" style={{ animationDelay: '360ms' }} />
      </div>
    </div>
  );
}
