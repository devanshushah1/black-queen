import type { Card, Seat } from '@/shared/types';
import { ChipRow } from './ChipRow';

interface Props {
  title: string;
  won: boolean;
  points: number;
  totalNeeded?: number; // for bidder team: show "/ needed N"
  members: Array<{ seat: Seat; name: string; role: 'bidder' | 'partner' | 'opponent'; isYou: boolean }>;
  capturedCards: Card[];
}

const ROLE_LABEL: Record<Props['members'][number]['role'], string> = {
  bidder: 'bidder',
  partner: 'partner',
  opponent: 'opponent',
};

const ROLE_COLOR: Record<Props['members'][number]['role'], string> = {
  bidder: 'text-gold-500',
  partner: 'text-pink-300',
  opponent: 'text-neutral-400',
};

export function TeamCard({ title, won, points, totalNeeded, members, capturedCards }: Props) {
  return (
    <div
      className={won
        ? 'bg-gold-500/10 border-2 border-gold-500 rounded-2xl p-4 shadow-xl shadow-gold-500/10'
        : 'bg-black/40 border-2 border-white/20 rounded-2xl p-4 opacity-80'}
    >
      <div className="flex justify-between items-baseline mb-2 pb-2 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">
          {title} · <b className={won ? 'text-gold-500' : 'text-white'}>{won ? 'Won' : 'Lost'}</b>
        </div>
        <div className={won ? 'text-2xl font-bold text-gold-500' : 'text-2xl font-bold text-white/70'}>
          {points}
          {totalNeeded !== undefined && (
            <span className="text-[11px] text-neutral-400 font-normal ml-1">/ needed {totalNeeded}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        {members.map((m) => (
          <div
            key={m.seat}
            className={m.isYou
              ? 'flex-1 bg-gold-500/15 border border-gold-500 rounded-lg p-2 text-center'
              : 'flex-1 bg-black/30 border border-white/10 rounded-lg p-2 text-center'}
          >
            <div className="text-sm font-semibold">{m.name}{m.isYou && ' (you)'}</div>
            <div className={`text-[9px] uppercase mt-0.5 ${ROLE_COLOR[m.role]}`}>{ROLE_LABEL[m.role]}</div>
          </div>
        ))}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-neutral-500 mb-1.5">Captured point cards</div>
      <ChipRow cards={capturedCards} />
    </div>
  );
}
