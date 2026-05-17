import { describe, test, expect, beforeEach, vi } from 'vitest';

class FakeAudioParam {
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  value = 0;
}
class FakeNode {
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
}
class FakeBufferSourceNode extends FakeNode {
  buffer: AudioBuffer | null = null;
  start = vi.fn();
  stop = vi.fn();
}
class FakeBiquadFilterNode extends FakeNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
}
class FakeGainNode extends FakeNode {
  gain = new FakeAudioParam();
}
class FakeOscillatorNode extends FakeNode {
  type: OscillatorType = 'sine';
  frequency = new FakeAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

const startCalls: { kind: string }[] = [];

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: 'running' | 'suspended' = 'running';
  destination = new FakeNode();
  resume = vi.fn(async () => { this.state = 'running'; });
  createBuffer(_channels: number, length: number, _rate: number): AudioBuffer {
    const data = new Float32Array(length);
    return { getChannelData: () => data, length, numberOfChannels: 1, sampleRate: 44100, duration: length / 44100 } as unknown as AudioBuffer;
  }
  createBufferSource(): FakeBufferSourceNode {
    const n = new FakeBufferSourceNode();
    n.start = vi.fn((..._a: unknown[]) => { startCalls.push({ kind: 'buffer' }); });
    return n;
  }
  createBiquadFilter(): FakeBiquadFilterNode { return new FakeBiquadFilterNode(); }
  createGain(): FakeGainNode { return new FakeGainNode(); }
  createOscillator(): FakeOscillatorNode {
    const n = new FakeOscillatorNode();
    n.start = vi.fn((..._a: unknown[]) => { startCalls.push({ kind: 'osc' }); });
    return n;
  }
}

beforeEach(() => {
  startCalls.length = 0;
  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: FakeAudioContext,
  };
});

import { useGameStore } from '@/client/store';
import { playSound, preloadSounds, resumeAudio, __resetAudioForTests } from '@/client/sounds';

describe('sounds (Web Audio synth)', () => {
  beforeEach(() => {
    __resetAudioForTests();
    useGameStore.setState({ muted: false });
  });

  test('playSound("thump") schedules an oscillator + a buffer when not muted', () => {
    preloadSounds();
    playSound('thump');
    expect(startCalls.length).toBeGreaterThanOrEqual(1);
    expect(startCalls.some((c) => c.kind === 'osc')).toBe(true);
  });

  test('playSound is a no-op when muted', () => {
    useGameStore.setState({ muted: true });
    preloadSounds();
    playSound('thump');
    expect(startCalls.length).toBe(0);
  });

  test('playSound("nonsense") does not throw and starts no nodes', () => {
    preloadSounds();
    expect(() => playSound('nonsense' as never)).not.toThrow();
    expect(startCalls.length).toBe(0);
  });

  test('resumeAudio is safe to call', () => {
    preloadSounds();
    expect(() => resumeAudio()).not.toThrow();
  });
});
