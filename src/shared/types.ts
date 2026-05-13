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
  /** Epoch ms of most recent disconnect, or null if connected. */
  disconnectedAt: number | null;
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
  'trump:choose': (
    payload: { trump: Suit; calledCard: Card },
    cb: (res: TrumpPartnerActionAck) => void
  ) => void;
  'card:play': (
    payload: { card: Card },
    cb: (res: PlayCardAck) => void
  ) => void;
  'room:play-again': (cb: (res: PlayAgainAck) => void) => void;
  'session:resume': (
    payload: { sessionId: string; code: string },
    cb: (res: ResumeAck) => void
  ) => void;
}

/** Server → Client */
export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
  'room:error': (payload: { code: 'NOT_FOUND' | 'FULL' | 'NAME_TAKEN' | 'NOT_HOST' | 'NEED_FOUR'; message: string }) => void;
  'hand:update': (payload: { hand: Card[] }) => void;
}

/** Result of room:create. */
export type CreateRoomResult =
  | { ok: true; sessionId: string; room: RoomView }
  | { ok: false; error: 'NAME_INVALID' };

/** Result of room:join. */
export type JoinRoomResult =
  | { ok: true; sessionId: string; room: RoomView }
  | { ok: false; error: 'NOT_FOUND' | 'FULL' | 'NAME_TAKEN' | 'NAME_INVALID' };

/** Result of room:start. */
export type StartGameResult =
  | { ok: true }
  | { ok: false; error: 'NOT_HOST' | 'NEED_FOUR' };

/** Result returned by session:resume. */
export type ResumeAck =
  | { ok: true; sessionId: string; room: Room }
  | { ok: false; error: 'NOT_FOUND' | 'REPLACED' };

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
// Trump + Partner choice
// =========================================================================

export interface TrumpPartnerChoice {
  /** Suit chosen by the bidder. */
  trump: Suit;
  /** Specific card the bidder calls. The owner becomes their partner. */
  calledCard: Card;
}

export type TrumpPartnerActionResult =
  | { ok: true }
  | { ok: false; error: 'NOT_BIDDER' | 'INVALID_CARD' | 'OWN_CARD' | 'NOT_IN_GAME' };

export type TrumpPartnerActionAck =
  | { ok: true }
  | { ok: false; error: 'NOT_BIDDER' | 'INVALID_CARD' | 'OWN_CARD' | 'NOT_IN_GAME' | 'NOT_IN_ROOM' };

// =========================================================================
// Tricks
// =========================================================================

/** A card played by a specific seat in a trick. */
export interface PlayedCard {
  seat: Seat;
  card: Card;
}

/** Trick currently being assembled (1-4 cards). */
export interface CurrentTrick {
  /** Seat that led this trick (plays the first card). */
  ledBy: Seat;
  /** Suit of the lead card (set after the first card is played). */
  ledSuit: Suit | null;
  /** Cards played so far, in play order. */
  plays: PlayedCard[];
}

/** A trick that has been completed (4 cards + winner determined). */
export interface CompletedTrick {
  ledBy: Seat;
  ledSuit: Suit;
  plays: PlayedCard[];     // exactly 4 cards
  winnerSeat: Seat;
}

export type PlayCardResult =
  | { ok: true }
  | { ok: false; error: 'NOT_YOUR_TURN' | 'NOT_IN_HAND' | 'MUST_FOLLOW_SUIT' | 'NOT_IN_GAME' };

export type PlayCardAck =
  | { ok: true }
  | { ok: false; error: 'NOT_YOUR_TURN' | 'NOT_IN_HAND' | 'MUST_FOLLOW_SUIT' | 'NOT_IN_GAME' | 'NOT_IN_ROOM' };

export type PlayAgainAck =
  | { ok: true }
  | { ok: false; error: 'NOT_HOST' | 'NOT_IN_END' | 'NOT_IN_ROOM' };

// =========================================================================
// Game state (added to Room when phase moves past 'lobby')
// =========================================================================

export interface GameState {
  bid: BidState;
  /** Trump suit + called partner card. Set when trump_partner phase completes. */
  trumpPartner: TrumpPartnerChoice | null;
  /** Current trick being built. Set when phase advances to 'play'. */
  currentTrick: CurrentTrick | null;
  /** Completed tricks in order (most recent last). Max 13. */
  completedTricks: CompletedTrick[];
  /**
   * Server-known partner seat. Wire visibility is `revealedPartnerSeat`.
   */
  partnerSeat: Seat | null;
  /** Public — set when the called card has been played. */
  revealedPartnerSeat: Seat | null;
}

/** Wire-format game state (no partnerSeat). */
export type PublicGameState = Omit<GameState, 'partnerSeat'>;

/**
 * Wire format sent to clients. Extends Room (public state) with optional `game`.
 * No `hands` field — those are per-player private and emitted via hand:update.
 */
export interface RoomView extends Room {
  game: PublicGameState | null;
}

/** Server-internal: full Room state including private hands. */
export interface RoomServerState extends Room {
  game: GameState | null;
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

/** Window during which a disconnected player can resume their seat (ms). */
export const REPLACEMENT_WINDOW_MS = 60_000;
