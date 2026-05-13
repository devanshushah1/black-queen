import { describe, test, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { useGameStore } from '@/client/store';

// Minimal localStorage mock for the node test environment.
function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: (n: number) => Object.keys(store)[n] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

describe('store muted state', () => {
  beforeAll(() => {
    if (typeof globalThis.localStorage === 'undefined') {
      Object.defineProperty(globalThis, 'localStorage', {
        value: makeStorage(),
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, 'window', {
        value: globalThis,
        writable: true,
        configurable: true,
      });
    }
  });

  afterAll(() => {
    // Clean up globals added for this suite.
    try { delete (globalThis as any).localStorage; } catch { /* ignore */ }
    try { delete (globalThis as any).window; } catch { /* ignore */ }
  });

  beforeEach(() => {
    globalThis.localStorage?.clear();
    useGameStore.setState({ muted: false });
  });

  test('defaults to false', () => {
    expect(useGameStore.getState().muted).toBe(false);
  });

  test('setMuted(true) updates state and writes to localStorage', () => {
    useGameStore.getState().setMuted(true);
    expect(useGameStore.getState().muted).toBe(true);
    expect(globalThis.localStorage?.getItem('bq:muted')).toBe('true');
  });

  test('setMuted(false) writes "false" to localStorage', () => {
    useGameStore.getState().setMuted(true);
    useGameStore.getState().setMuted(false);
    expect(useGameStore.getState().muted).toBe(false);
    expect(globalThis.localStorage?.getItem('bq:muted')).toBe('false');
  });
});
