interface StartCardProps {
  filled: number;     // current player count
  isHost: boolean;
  onStart?: () => void;
}

export function StartCard({ filled, isHost, onStart }: StartCardProps) {
  const ready = filled >= 4;
  const sub =
    !ready
      ? `Need ${4 - filled} more to start`
      : isHost
      ? "Everyone seated · let's play"
      : 'Waiting for host to start…';

  return (
    <div
      className={
        ready
          ? 'w-56 bg-black/40 border border-gold-500/60 rounded-xl p-4 shadow-xl shadow-gold-500/10 text-center'
          : 'w-56 bg-black/40 border border-white/15 rounded-xl p-4 text-center'
      }
    >
      <div className="text-[9px] uppercase tracking-widest text-neutral-400 mb-1.5">
        Players ready
      </div>
      <div className="text-2xl font-bold">
        <span className="text-gold-500">{filled}</span>
        <span className="text-neutral-500">/4</span>
      </div>
      <div className={ready ? 'text-[10px] text-gold-500 mb-2.5' : 'text-[10px] text-neutral-400 mb-2.5'}>
        {sub}
      </div>
      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          className={
            ready
              ? 'w-full bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-lg py-2 text-sm'
              : 'w-full bg-white/5 text-neutral-500 cursor-not-allowed rounded-lg py-2 text-sm font-bold'
          }
        >
          Start Game
        </button>
      ) : (
        <div className="text-[10px] italic text-neutral-500 py-2">…</div>
      )}
    </div>
  );
}
