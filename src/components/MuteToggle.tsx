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
      className="fixed top-3 right-3 z-50 w-9 h-9 rounded-full bg-felt-800/80 border border-gold-500/30 text-white hover:bg-felt-700 transition-colors flex items-center justify-center text-base"
      data-testid="mute-toggle"
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
