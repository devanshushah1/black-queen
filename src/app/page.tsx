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
    <main className="min-h-screen relative bg-[#020b08] felt-grain p-6 overflow-hidden flex flex-col items-center justify-center gap-6 select-none font-sans text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gold-500/[0.02] rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-felt-500/[0.03] rounded-full filter blur-[150px] pointer-events-none" />

      {/* Luxury Logo Header */}
      <div className="text-center z-20">
        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gold-600 via-gold-500 to-gold-600 shadow-glass-gold mb-3.5 animate-pulse-slow">
          <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />
          <svg className="w-10 h-10 text-black filter drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 16L3 5l5 5 4-7 4 7 5-5-2 11H5zm14 2H5v2h14v-2z"/>
          </svg>
        </div>
        <h1 className="text-4xl font-extrabold font-serif tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white via-gold-300 to-gold-400 drop-shadow-[0_2px_8px_rgba(212,165,45,0.15)] leading-none">
          Black Queen
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-extrabold mt-2">
          A 4-Player Trick-Taking Card Game
        </p>
      </div>

      {/* Entrance Form Card */}
      <div className="w-80 bg-black/45 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-glass relative hover:border-gold-500/20 transition-all duration-500 z-20">
        {/* Fine double border inside */}
        <div className="absolute inset-1.5 border border-white/[0.03] rounded-xl pointer-events-none" />
        
        <form className="space-y-4 relative z-10">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-gold-400 font-extrabold mb-1.5">
              Your Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none text-white focus:border-gold-500 focus:bg-white/[0.06] focus:ring-1 focus:ring-gold-500/30 transition-all duration-300 placeholder:text-white/20"
              placeholder="e.g. Dev"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="w-full bg-gradient-to-r from-gold-600 via-gold-500 to-gold-600 hover:from-gold-500 hover:to-gold-400 active:scale-[0.98] disabled:opacity-50 text-black font-extrabold rounded-xl py-3 text-sm shadow-lg tracking-wider transition-all duration-300 flex items-center justify-center gap-2"
          >
            Create a new room
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-[1px] bg-white/10" />
            <span className="text-[9px] uppercase tracking-widest text-neutral-500 font-bold">
              or join an existing room
            </span>
            <div className="flex-1 h-[1px] bg-white/10" />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-gold-400 font-extrabold mb-1.5">
              Room Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none text-gold-400 focus:border-gold-500 focus:bg-white/[0.06] focus:ring-1 focus:ring-gold-500/30 transition-all duration-300 uppercase tracking-widest text-center font-mono placeholder:text-gold-500/20"
              placeholder="ABCD"
            />
          </div>

          <button
            type="button"
            onClick={handleJoin}
            disabled={busy}
            className="w-full bg-transparent hover:bg-gold-500/[0.04] border border-gold-500/40 hover:border-gold-500 text-gold-400 hover:text-gold-300 font-extrabold rounded-xl py-3 text-sm tracking-wider transition-all duration-300 flex items-center justify-center gap-2"
          >
            Join room
          </button>

          {error && (
            <div className="text-red-400 text-xs text-center font-medium bg-red-950/20 border border-red-500/20 rounded-lg py-2 px-3 mt-2">
              {error}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
