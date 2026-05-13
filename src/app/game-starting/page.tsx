'use client';
import { useGameStore } from '@/client/store';

export default function GameStartingPage() {
  const room = useGameStore((s) => s.room);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <div className="text-gold-500 text-5xl font-serif">♛</div>
      <div className="text-2xl font-bold">Game starting…</div>
      <div className="text-sm text-neutral-400">
        Phase: <b className="text-gold-500">{room?.phase ?? 'unknown'}</b>
      </div>
      <div className="text-xs text-neutral-500 mt-2">
        (Bidding UI lands in Plan 2.)
      </div>
    </main>
  );
}
