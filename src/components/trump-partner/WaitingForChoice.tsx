interface Props {
  bidderName: string;
}

export function WaitingForChoice({ bidderName }: Props) {
  return (
    <div className="w-[360px] bg-black/45 backdrop-blur-md border border-white/10 rounded-2xl p-6 text-center shadow-glass relative">
      <div className="absolute inset-1.5 border border-white/[0.02] rounded-xl pointer-events-none" />
      <div className="text-gold-400 font-extrabold text-lg uppercase tracking-wider">{bidderName} is choosing</div>
      <div className="text-xs text-neutral-300 mt-2 font-medium">Trump suit and partner card</div>
      <div className="flex gap-2 justify-center mt-5">
        <span className="w-2.5 h-2.5 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2.5 h-2.5 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2.5 h-2.5 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
