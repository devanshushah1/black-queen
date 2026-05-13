import { describe, it, expect, beforeEach } from 'vitest';
import { generateRoomCode, createRoom, getRoom, _resetRoomsForTest } from '@/server/rooms';

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
