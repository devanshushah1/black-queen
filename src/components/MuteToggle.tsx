'use client';
import { useGameStore } from '@/client/store';

export function MuteToggle() {
  const muted = useGameStore((s) => s.muted);
  const setMuted = useGameStore((s) => s.setMuted);

  return (
    <button
      type="button"
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      aria-pressed={muted}
      onClick={() => setMuted(!muted)}
      className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-gold-400 hover:text-gold-300 hover:border-gold-500/50 shadow-glass flex items-center justify-center transition-all duration-300 transform hover:scale-105"
      data-testid="mute-toggle"
    >
      {muted ? (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.03a8.03 8.03 0 003.72-1.79L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      )}
    </button>
  );
}
