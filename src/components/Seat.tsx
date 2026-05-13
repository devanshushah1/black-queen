import { Avatar, colorForName } from './Avatar';
import type { Player } from '@/shared/types';

interface SeatProps {
  player: Player | null;
  seatLabel: string;      // e.g. "seat 2"
  isYou?: boolean;
  isHost?: boolean;
}

export function Seat({ player, seatLabel, isYou, isHost }: SeatProps) {
  const empty = player === null;

  return (
    <div
      className={
        empty
          ? 'w-40 text-center bg-white/[0.03] border-2 border-dashed border-white/20 rounded-xl p-3 text-neutral-500'
          : isYou
          ? 'w-40 text-center bg-gold-500/15 border-2 border-gold-500 rounded-xl p-3'
          : 'w-40 text-center bg-black/40 border-2 border-white/20 rounded-xl p-3'
      }
    >
      {empty ? (
        <div
          className="w-12 h-12 rounded-full mx-auto mb-1.5 flex items-center justify-center text-2xl text-neutral-500 border-2 border-dashed border-white/20 bg-white/5"
          aria-hidden
        >
          +
        </div>
      ) : (
        <div className="mb-1.5 flex justify-center">
          <Avatar name={player.name} color={colorForName(player.name)} size={48} />
        </div>
      )}
      <div className="text-sm font-semibold">{empty ? 'Waiting…' : player.name}</div>
      <div
        className={
          isHost ? 'text-[9px] uppercase tracking-wider text-gold-500 font-bold mt-0.5' : 'text-[9px] uppercase tracking-wider text-neutral-400 mt-0.5'
        }
      >
        {isHost ? '★ host · ' : ''}{isYou ? 'you · ' : ''}{seatLabel}
      </div>
      {!empty && !player.connected && (
        <div className="mt-1 text-[10px] text-amber-400">Disconnected</div>
      )}
    </div>
  );
}
