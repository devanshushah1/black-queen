'use client';
import { useGameStore } from '@/client/store';

export type SoundName = 'shuffle' | 'whip' | 'thump' | 'sweep';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Called once on app mount. Creates the AudioContext (suspended in most browsers). */
export function preloadSounds(): void {
  getCtx();
}

/** Call from a user-gesture click handler to unlock audio (Safari requirement). */
export function resumeAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
}

function makeNoise(c: AudioContext, durationSec: number): AudioBufferSourceNode {
  const length = Math.max(1, Math.floor(c.sampleRate * durationSec));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  return src;
}

function playShuffle(c: AudioContext): void {
  const now = c.currentTime;
  const src = makeNoise(c, 0.6);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2500, now);
  filter.frequency.exponentialRampToValueAtTime(700, now + 0.5);
  filter.Q.value = 1.2;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(now);
  src.stop(now + 0.6);
}

function playWhip(c: AudioContext): void {
  const now = c.currentTime;
  const src = makeNoise(c, 0.12);
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(2000, now);
  filter.frequency.exponentialRampToValueAtTime(500, now + 0.1);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(now);
  src.stop(now + 0.12);
}

function playThump(c: AudioContext): void {
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.13);
  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.linearRampToValueAtTime(0.22, now + 0.008);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  osc.connect(oscGain).connect(c.destination);
  const noise = makeNoise(c, 0.05);
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 1500;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.06, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  noise.connect(noiseFilter).connect(noiseGain).connect(c.destination);
  osc.start(now);
  noise.start(now);
  osc.stop(now + 0.15);
  noise.stop(now + 0.05);
}

function playSweep(c: AudioContext): void {
  const now = c.currentTime;
  const src = makeNoise(c, 0.45);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(3000, now + 0.3);
  filter.Q.value = 1.5;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.16, now + 0.06);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(now);
  src.stop(now + 0.45);
}

export function playSound(name: SoundName): void {
  if (useGameStore.getState().muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  try {
    if (name === 'shuffle') playShuffle(c);
    else if (name === 'whip') playWhip(c);
    else if (name === 'thump') playThump(c);
    else if (name === 'sweep') playSweep(c);
  } catch {
    /* ignore audio playback errors */
  }
}

/** Test-only: reset the module-level AudioContext between tests. */
export function __resetAudioForTests(): void {
  ctx = null;
}
