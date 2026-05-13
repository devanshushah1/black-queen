// =========================================================================
// Domain types — used both server-side (in rooms.ts) and on the client.
// =========================================================================

export type GamePhase = 'lobby' | 'bidding' | 'trump_partner' | 'play' | 'end';

export interface Player {
  /** Server-issued session id; survives reconnect within the room. */
  id: string;
  /** Display name (unique within the room). */
  name: string;
  /** 1..4 — seat-to-name mapping is fixed for the room's lifetime. */
  seat: 1 | 2 | 3 | 4;
  /** Is this player currently connected? */
  connected: boolean;
}

export interface ChatMessage {
  id: string;          // uuid
  authorId: string | null;  // null = system message
  authorName: string | null;
  text: string;
  ts: number;          // epoch ms
}

export interface Room {
  code: string;        // 4 uppercase letters
  hostId: string;      // session id of the host
  phase: GamePhase;
  players: Player[];
  chat: ChatMessage[];
  createdAt: number;
}

// =========================================================================
// Socket events — typed payloads for client ↔ server messages.
// =========================================================================

/** Client → Server */
export interface ClientToServerEvents {
  'room:create': (payload: { name: string }, cb: (res: CreateRoomResult) => void) => void;
  'room:join':   (payload: { code: string; name: string }, cb: (res: JoinRoomResult) => void) => void;
  'room:leave':  () => void;
  'room:start':  (cb: (res: StartGameResult) => void) => void;
  'chat:send':   (payload: { text: string }) => void;
}

/** Server → Client */
export interface ServerToClientEvents {
  'room:state': (room: Room) => void;
  'room:error': (payload: { code: 'NOT_FOUND' | 'FULL' | 'NAME_TAKEN' | 'NOT_HOST' | 'NEED_FOUR'; message: string }) => void;
}

/** Result of room:create. */
export type CreateRoomResult =
  | { ok: true; sessionId: string; room: Room }
  | { ok: false; error: 'NAME_INVALID' };

/** Result of room:join. */
export type JoinRoomResult =
  | { ok: true; sessionId: string; room: Room }
  | { ok: false; error: 'NOT_FOUND' | 'FULL' | 'NAME_TAKEN' | 'NAME_INVALID' };

/** Result of room:start. */
export type StartGameResult =
  | { ok: true }
  | { ok: false; error: 'NOT_HOST' | 'NEED_FOUR' };

// =========================================================================
// Constants
// =========================================================================

export const ROOM_CODE_LENGTH = 4;
export const MAX_PLAYERS = 4;
export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 20;
