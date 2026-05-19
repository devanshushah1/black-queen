import { Avatar } from './Avatar';
import type { Player } from '@/shared/types';

interface SeatProps {
  player: Player | null;
  seatLabel: string;      // e.g. "seat 2"
  isYou?: boolean;
  isHost?: boolean;
}

export function Seat({ player, seatLabel, isYou, isHost }: SeatProps) {
  const empty = player === null;

  // Premium glassmorphism border & shadow classes
  const seatClass = empty
    ? 'w-40 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl p-3.5 text-neutral-500 shadow-glass'
    : isYou
    ? 'w-40 text-center bg-gold-500/[0.06] border-2 border-gold-500/80 rounded-xl p-3.5 shadow-glass-gold animate-pulse-slow'
    : 'w-40 text-center bg-black/45 backdrop-blur-md border border-white/15 rounded-xl p-3.5 shadow-glass';

  return (
    <div className={`${seatClass} transition-all duration-300 transform hover:-translate-y-1`}>
      {empty ? (
        <div
          className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-xl text-neutral-500 border border-dashed border-white/10 bg-white/[0.02]"
          aria-hidden
        >
          <svg className="w-5 h-5 opacity-40 animate-pulse-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      ) : (
        <div className="mb-2 flex justify-center relative">
          <Avatar name={player.name} size={48} />
          {isHost && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold-500 text-[10px] text-black font-extrabold shadow border border-white/20">
              ★
            </span>
          )}
        </div>
      )}

      <div className="text-sm font-extrabold tracking-tight text-white/90">
        {empty ? 'Waiting…' : player.name}
      </div>

      <div
        className={
          isHost 
            ? 'text-[9px] uppercase tracking-widest text-gold-400 font-extrabold mt-1' 
            : 'text-[9px] uppercase tracking-widest text-neutral-400 font-medium mt-1'
        }
      >
        {isHost ? '★ host · ' : ''}{isYou ? 'you · ' : ''}{seatLabel}
      </div>

      {!empty && !player.connected && (() => {
        const since = player.disconnectedAt ?? Date.now();
        const replaceable = Date.now() - since >= 60_000;
        return replaceable
          ? <div className="mt-1.5 text-[9px] text-orange-300/80 font-bold uppercase tracking-wider animate-pulse">Open for replacement</div>
          : <div className="mt-1.5 text-[9px] text-amber-400/90 font-bold uppercase tracking-wider animate-pulse-slow">Reconnecting…</div>;
      })()}
    </div>
  );
}
