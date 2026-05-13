'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { useGameStore } from '@/client/store';
import { saveSession } from '@/client/session';
import type { CreateRoomResult, JoinRoomResult } from '@/shared/types';

export default function LandingPage() {
  const socket = useSocket();
  const router = useRouter();
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function withSubmit(fn: () => Promise<void>) {
    return async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    };
  }

  const handleCreate = withSubmit(async () => {
    if (!name.trim()) {
      setError('Pick a display name');
      return;
    }
    const res = await new Promise<CreateRoomResult>((resolve) =>
      socket.emit('room:create', { name: name.trim() }, resolve)
    );
    if (!res.ok) {
      setError(res.error === 'NAME_INVALID' ? 'Name must be 1–20 characters.' : 'Could not create room.');
      return;
    }
    setSession(res.sessionId);
    setRoom(res.room);
    saveSession({ sessionId: res.sessionId, code: res.room.code });
    router.push(`/room/${res.room.code}`);
  });

  const handleJoin = withSubmit(async () => {
    const cleanCode = code.toUpperCase().replace(/[^A-Z]/g, '');
    if (cleanCode.length !== 4) {
      setError('Room code must be 4 letters.');
      return;
    }
    if (!name.trim()) {
      setError('Pick a display name');
      return;
    }
    const res = await new Promise<JoinRoomResult>((resolve) =>
      socket.emit('room:join', { code: cleanCode, name: name.trim() }, resolve)
    );
    if (!res.ok) {
      setError(
        res.error === 'NOT_FOUND' ? 'Room not found.'
        : res.error === 'FULL' ? 'Room is full.'
        : res.error === 'NAME_TAKEN' ? 'Name is taken in that room.'
        : 'Invalid name.'
      );
      return;
    }
    setSession(res.sessionId);
    setRoom(res.room);
    saveSession({ sessionId: res.sessionId, code: cleanCode });
    router.push(`/room/${cleanCode}`);
  });

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">
      <div className="text-center">
        <div className="text-gold-500 text-6xl font-serif leading-none">♛</div>
        <div className="text-2xl font-bold mt-1">Black Queen</div>
        <div className="text-xs text-neutral-400 mt-1">A 4-player trick-taking card game</div>
      </div>

      <div className="w-80 bg-black/40 border border-white/10 rounded-xl p-5 shadow-2xl">
        <form className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
              Your display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500"
              placeholder="e.g. Dev"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-black font-bold rounded-lg py-2.5 text-sm"
          >
            Create a new room
          </button>

          <div className="text-center text-[10px] uppercase tracking-widest text-neutral-500 my-2">
            or join an existing room
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">Room code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500 uppercase tracking-widest text-center font-mono text-gold-500"
              placeholder="ABCD"
            />
          </div>

          <button
            type="button"
            onClick={handleJoin}
            disabled={busy}
            className="w-full bg-transparent hover:border-gold-500 hover:text-gold-500 border border-white/20 text-neutral-200 rounded-lg py-2.5 text-sm font-bold"
          >
            Join room
          </button>

          {error && <div className="text-red-400 text-xs text-center">{error}</div>}
        </form>
      </div>
    </main>
  );
}
