'use client';

const KEY = 'black-queen-session';

export interface StoredSession {
  sessionId: string;
  code: string;
}

export function saveSession(session: StoredSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* noop */
  }
}

export function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.sessionId === 'string' && typeof parsed?.code === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
