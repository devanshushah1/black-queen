import { describe, it, expect, beforeEach } from 'vitest';
import { generateRoomCode, createRoom, getRoom, _resetRoomsForTest } from '@/server/rooms';
import { joinRoom } from '@/server/rooms';
import { leaveRoom, postChat } from '@/server/rooms';
import { startGame, setConnected } from '@/server/rooms';

beforeEach(() => _resetRoomsForTest());

describe('generateRoomCode', () => {
  it('returns 4 uppercase letters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-Z]{4}$/);
    }
  });
});

describe('createRoom', () => {
  it('creates a room with host as first player in seat 1', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    expect(room.code).toMatch(/^[A-Z]{4}$/);
    expect(room.phase).toBe('lobby');
    expect(room.players).toHaveLength(1);
    expect(room.players[0]).toMatchObject({ name: 'Dev', seat: 1, connected: true });
    expect(room.hostId).toBe(room.players[0].id);
    expect(sessionId).toBe(room.players[0].id);
  });

  it('makes the room retrievable by code', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    expect(getRoom(room.code)).toEqual(room);
  });

  it('rejects empty / too-long names', () => {
    expect(() => createRoom({ hostName: '' })).toThrow(/NAME_INVALID/);
    expect(() => createRoom({ hostName: 'a'.repeat(21) })).toThrow(/NAME_INVALID/);
  });

  it('trims whitespace and rejects whitespace-only names', () => {
    expect(() => createRoom({ hostName: '   ' })).toThrow(/NAME_INVALID/);
    const { room } = createRoom({ hostName: '  Dev  ' });
    expect(room.players[0].name).toBe('Dev');
  });

  it('generates unique codes for concurrent rooms', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(createRoom({ hostName: `User${i}` }).room.code);
    }
    expect(codes.size).toBe(50);
  });
});

describe('joinRoom', () => {
  it('adds a second player into seat 2', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = joinRoom({ code: room.code, name: 'Sam' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.players).toHaveLength(2);
    expect(res.room.players[1]).toMatchObject({ name: 'Sam', seat: 2, connected: true });
  });

  it('fills seats 2, 3, 4 in order', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    const res = joinRoom({ code: room.code, name: 'Aman' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const seats = res.room.players.map((p) => p.seat);
    expect(seats).toEqual([1, 2, 3, 4]);
  });

  it('rejects an unknown room code with NOT_FOUND', () => {
    const res = joinRoom({ code: 'ZZZZ', name: 'Sam' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NOT_FOUND');
  });

  it('rejects when the room is full (4 players)', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    joinRoom({ code: room.code, name: 'Aman' });
    const res = joinRoom({ code: room.code, name: 'Extra' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('FULL');
  });

  it('rejects duplicate names case-insensitively', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = joinRoom({ code: room.code, name: 'DEV' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NAME_TAKEN');
  });

  it('rejects invalid names', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = joinRoom({ code: room.code, name: '' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NAME_INVALID');
  });

  it('appends a system chat message on join', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = joinRoom({ code: room.code, name: 'Sam' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const last = res.room.chat[res.room.chat.length - 1];
    expect(last.authorId).toBeNull();
    expect(last.text).toMatch(/Sam joined/);
  });
});

describe('leaveRoom', () => {
  it('removes the player and reshuffles seats', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const join = joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    if (!join.ok) throw new Error('precondition');

    const res = leaveRoom({ code: room.code, sessionId: join.sessionId });
    expect(res.ok).toBe(true);
    if (!res.ok || res.wasLastPlayer) return;
    expect(res.room.players.map((p) => p.name)).toEqual(['Dev', 'Riya']);
    expect(res.room.players.map((p) => p.seat)).toEqual([1, 2]);
  });

  it('transfers host to the next remaining player when host leaves', () => {
    const { room, sessionId: hostId } = createRoom({ hostName: 'Dev' });
    const join = joinRoom({ code: room.code, name: 'Sam' });
    if (!join.ok) throw new Error('precondition');

    const res = leaveRoom({ code: room.code, sessionId: hostId });
    expect(res.ok).toBe(true);
    if (!res.ok || res.wasLastPlayer) return;
    expect(res.room.hostId).toBe(join.sessionId);
  });

  it('deletes the room entirely when the last player leaves', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    leaveRoom({ code: room.code, sessionId });
    expect(getRoom(room.code)).toBeUndefined();
  });

  it('returns NOT_FOUND for unknown room', () => {
    const res = leaveRoom({ code: 'ZZZZ', sessionId: 'fake' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NOT_FOUND');
  });

  it('appends a system chat message on leave (when room still exists)', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const join = joinRoom({ code: room.code, name: 'Sam' });
    if (!join.ok) throw new Error('precondition');
    const res = leaveRoom({ code: room.code, sessionId: join.sessionId });
    expect(res.ok).toBe(true);
    if (!res.ok || res.wasLastPlayer) return;
    const last = res.room.chat[res.room.chat.length - 1];
    expect(last.text).toMatch(/Sam left/);
  });
});

describe('postChat', () => {
  it('appends a chat message from a player', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    const res = postChat({ code: room.code, sessionId, text: 'hello' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const last = res.room.chat[res.room.chat.length - 1];
    expect(last).toMatchObject({ authorName: 'Dev', text: 'hello' });
  });

  it('trims whitespace and rejects empty', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    const res = postChat({ code: room.code, sessionId, text: '   ' });
    expect(res.ok).toBe(false);
  });

  it('caps message length at 200 chars', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    const res = postChat({ code: room.code, sessionId, text: 'a'.repeat(201) });
    expect(res.ok).toBe(false);
  });

  it('rejects from unknown sessionId', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = postChat({ code: room.code, sessionId: 'fake', text: 'hi' });
    expect(res.ok).toBe(false);
  });
});

describe('startGame', () => {
  it('moves phase from lobby to bidding when host starts with 4 players', () => {
    const { room, sessionId: hostId } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    joinRoom({ code: room.code, name: 'Aman' });

    const res = startGame({ code: room.code, sessionId: hostId });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.phase).toBe('bidding');
  });

  it('rejects with NEED_FOUR when fewer than 4 players', () => {
    const { room, sessionId: hostId } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });

    const res = startGame({ code: room.code, sessionId: hostId });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NEED_FOUR');
  });

  it('rejects non-host with NOT_HOST', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const sam = joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    joinRoom({ code: room.code, name: 'Aman' });
    if (!sam.ok) throw new Error('precondition');

    const res = startGame({ code: room.code, sessionId: sam.sessionId });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NOT_HOST');
  });
});

describe('setConnected', () => {
  it('flips a player.connected flag', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    setConnected({ code: room.code, sessionId, connected: false });
    expect(getRoom(room.code)?.players[0].connected).toBe(false);
    setConnected({ code: room.code, sessionId, connected: true });
    expect(getRoom(room.code)?.players[0].connected).toBe(true);
  });

  it('is a no-op if the session is not in the room', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    expect(() => setConnected({ code: room.code, sessionId: 'unknown', connected: false })).not.toThrow();
  });
});
