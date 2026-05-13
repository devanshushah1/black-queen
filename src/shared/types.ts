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
  'bid:place':  (payload: { amount: number }, cb: (res: BidActionAck) => void) => void;
  'bid:pass':   (cb: (res: BidActionAck) => void) => void;
}

/** Server → Client */
export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
  'room:error': (payload: { code: 'NOT_FOUND' | 'FULL' | 'NAME_TAKEN' | 'NOT_HOST' | 'NEED_FOUR'; message: string }) => void;
  'hand:update': (payload: { hand: Card[] }) => void;
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
// Bidding
// =========================================================================

export const MIN_BID = 75;
export const MAX_BID = 150;
export const BID_INCREMENT = 5;

export type Seat = 1 | 2 | 3 | 4;

export interface BidState {
  /** Highest bid placed so far. Null until the first bid. */
  currentBid: number | null;
  /** Seat that holds the current high bid. Null if no bid yet. */
  currentBidderSeat: Seat | null;
  /** Seats that have passed at the CURRENT bid level. Reset on every new bid. */
  passedSeats: Seat[];
  /** True when bidding is finalized (3 non-bidders have passed at the current bid). */
  complete: boolean;
}

export type BidActionResult =
  | { ok: true; state: BidState; justCompleted: boolean }
  | { ok: false; error: 'INVALID_AMOUNT' | 'NOT_HIGHER' | 'ALREADY_BIDDER' | 'NO_BID_TO_PASS' | 'NOT_IN_GAME' };

/** Wire-format ack for bid:place and bid:pass. */
export type BidActionAck =
  | { ok: true }
  | { ok: false; error: 'INVALID_AMOUNT' | 'NOT_HIGHER' | 'ALREADY_BIDDER' | 'NO_BID_TO_PASS' | 'NOT_IN_GAME' | 'NOT_IN_ROOM' };

// =========================================================================
// Game state (added to Room when phase moves past 'lobby')
// =========================================================================

export interface GameState {
  bid: BidState;
}

/**
 * Wire format sent to clients. Extends Room (public state) with optional `game`.
 * No `hands` field — those are per-player private and emitted via hand:update.
 */
export interface RoomView extends Room {
  game: GameState | null;
}

/** Server-internal: full Room state including private hands. */
export interface RoomServerState extends RoomView {
  /** Server-only. Each player's 13 cards. Never broadcast directly. */
  hands: Record<Seat, Card[]> | null;
}

// =========================================================================
// Constants
// =========================================================================

export const ROOM_CODE_LENGTH = 4;
export const MAX_PLAYERS = 4;
export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 20;
