'use client';
import { Howl } from 'howler';
import { useGameStore } from '@/client/store';

export type SoundName = 'shuffle' | 'whip' | 'thump' | 'sweep';

const VOLUME: Record<SoundName, number> = {
  shuffle: 0.5,
  whip: 0.25,
  thump: 0.45,
  sweep: 0.4,
};

const FILES: Record<SoundName, string> = {
  shuffle: '/sounds/shuffle.mp3',
  whip: '/sounds/whip.mp3',
  thump: '/sounds/thump.mp3',
  sweep: '/sounds/sweep.mp3',
};

let pool: Record<SoundName, Howl> | null = null;

export function preloadSounds() {
  if (pool) return;
  pool = {
    shuffle: new Howl({ src: [FILES.shuffle], volume: VOLUME.shuffle, preload: true }),
    whip: new Howl({ src: [FILES.whip], volume: VOLUME.whip, preload: true }),
    thump: new Howl({ src: [FILES.thump], volume: VOLUME.thump, preload: true }),
    sweep: new Howl({ src: [FILES.sweep], volume: VOLUME.sweep, preload: true }),
  };
}

export function playSound(name: SoundName) {
  if (useGameStore.getState().muted) return;
  if (!pool) preloadSounds();
  const h = pool && pool[name];
  if (!h) return;
  try {
    h.play();
  } catch {
    /* ignore audio playback errors */
  }
}
