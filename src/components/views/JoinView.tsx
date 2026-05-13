'use client';
import { useState } from 'react';
import type { JoinRoomResult } from '@/shared/types';

interface JoinViewProps {
  code: string;
  onSubmit: (name: string) => Promise<JoinRoomResult>;
}

export function JoinView({ code, onSubmit }: JoinViewProps) {
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr('Pick a display name'); return; }
    setBusy(true);
    const res = await onSubmit(name.trim());
    setBusy(false);
    if (!res.ok) {
      setErr(
        res.error === 'NOT_FOUND' ? 'Room not found.'
        : res.error === 'FULL' ? 'Room is full.'
        : res.error === 'NAME_TAKEN' ? 'Name is taken.'
        : 'Invalid name.'
      );
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">
      <div className="text-center">
        <div className="text-gold-500 text-5xl font-serif leading-none">♛</div>
        <div className="text-xl font-bold mt-1">Black Queen</div>
      </div>
      <div className="w-80 bg-black/40 border border-white/10 rounded-xl p-5">
        <div className="text-center text-xs text-neutral-400">You&apos;ve been invited to room</div>
        <div className="text-center text-lg font-mono font-bold text-gold-500 mt-1">{code}</div>
        <form onSubmit={handle} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">Your display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500"
              placeholder="Pick something fun"
            />
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-black font-bold rounded-lg py-2.5 text-sm">
            Join room
          </button>
          {err && <div className="text-red-400 text-xs text-center">{err}</div>}
        </form>
      </div>
    </main>
  );
}
