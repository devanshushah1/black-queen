import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('howler', () => {
  const play = vi.fn();
  return {
    Howl: vi.fn().mockImplementation(() => ({ play })),
    __mockPlay: play,
  };
});

import { useGameStore } from '@/client/store';
import { playSound, preloadSounds } from '@/client/sounds';
import * as howler from 'howler';

const mockedPlay = (howler as unknown as { __mockPlay: ReturnType<typeof vi.fn> }).__mockPlay;

describe('sounds module', () => {
  beforeEach(() => {
    mockedPlay.mockClear();
    useGameStore.setState({ muted: false });
    preloadSounds();
  });

  test('playSound triggers Howl.play() when not muted', () => {
    playSound('thump');
    expect(mockedPlay).toHaveBeenCalledTimes(1);
  });

  test('playSound is a no-op when muted', () => {
    useGameStore.setState({ muted: true });
    playSound('thump');
    expect(mockedPlay).not.toHaveBeenCalled();
  });

  test('unknown sound name is a no-op (does not throw)', () => {
    expect(() => playSound('nonsense' as never)).not.toThrow();
    expect(mockedPlay).not.toHaveBeenCalled();
  });
});
