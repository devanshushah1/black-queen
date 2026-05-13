import { randomUUID } from 'node:crypto';
import {
  type Room,
  type Player,
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  ROOM_CODE_LENGTH,
} from '@/shared/types';

// In-memory store; process-local. Fine for single-instance hobby deploys.
const rooms = new Map<string, Room>();

/** Visible for tests only. */
export function _resetRoomsForTest(): void {
  rooms.clear();
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return code;
}

function generateUniqueRoomCode(): string {
  // Probability of collision with 4-letter codes (26^4 = 456,976) is negligible
  // for hobby usage, but we still retry to be safe.
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateRoomCode();
    if (!rooms.has(code)) return code;
  }
  throw new Error('Could not generate a unique room code; too many active rooms');
}

function validateName(raw: string): string {
  const name = raw.trim();
  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    throw new Error('NAME_INVALID');
  }
  return name;
}

export interface CreateRoomInput {
  hostName: string;
}

export interface CreateRoomOutput {
  room: Room;
  sessionId: string;
}

export function createRoom(input: CreateRoomInput): CreateRoomOutput {
  const name = validateName(input.hostName);
  const hostId = randomUUID();
  const host: Player = { id: hostId, name, seat: 1, connected: true };

  const room: Room = {
    code: generateUniqueRoomCode(),
    hostId,
    phase: 'lobby',
    players: [host],
    chat: [{ id: randomUUID(), authorId: null, authorName: null, text: `${name} created the room`, ts: Date.now() }],
    createdAt: Date.now(),
  };

  rooms.set(room.code, room);
  return { room, sessionId: hostId };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}
