'use client';
import { useRouter } from 'next/navigation';

export function BouncedView() {
  const router = useRouter();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-gold-500 text-5xl font-serif">♛</div>
      <div className="text-xl font-bold">This room resumed without you</div>
      <div className="text-sm text-neutral-400 max-w-md text-center">
        You were disconnected for more than 60 seconds and another player took your seat. You can return to the
        landing page and create or join a new room.
      </div>
      <button
        type="button"
        onClick={() => router.push('/')}
        className="bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-lg px-5 py-2 text-sm"
      >
        Back to landing
      </button>
    </main>
  );
}
