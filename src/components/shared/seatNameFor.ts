import type { Player } from '@/shared/types';

export function seatNameFor(players: Player[], seat: number | null): string {
  if (seat === null) return '—';
  const p = players.find((p) => p.seat === seat);
  return p?.name ?? `seat ${seat}`;
}
