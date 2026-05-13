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
// Cards
// =========================================================================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: ReadonlyArray<Suit> = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: ReadonlyArray<Rank> = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Point value of a card. 5s=5, 10s=10, Aces=15, Queen of Spades=30, else 0. */
export function pointValue(card: Card): number {
  if (card.rank === '5') return 5;
  if (card.rank === '10') return 10;
  if (card.rank === 'A') return 15;
  if (card.suit === 'spades' && card.rank === 'Q') return 30;
  return 0;
}

/** Stable string key for a card. */
export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`;
}

// =========================================================================
// Constants
// =========================================================================

export const ROOM_CODE_LENGTH = 4;
export const MAX_PLAYERS = 4;
export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 20;
