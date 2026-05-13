import { randomUUID } from 'node:crypto';
import {
  type RoomServerState,
  type Player,
  type JoinRoomResult,
  type Seat,
  type Card,
  type Suit,
  type CompletedTrick,
  cardKey,
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  MAX_PLAYERS,
  ROOM_CODE_LENGTH,
} from '@/shared/types';
import { createDeck, shuffle, deal } from './game/deck';
import { emptyBidState, placeBid, passBid } from './game/bidding';
import { toRoomView } from './game/view';
import { validateTrumpPartnerChoice } from './game/trump-partner';
import { startTrick, isLegalPlay, playCardInTrick, resolveTrick } from './game/trick';

// In-memory store; process-local. Fine for single-instance hobby deploys.
const rooms = new Map<string, RoomServerState>();

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
  room: RoomServerState;
  sessionId: string;
}

export function createRoom(input: CreateRoomInput): CreateRoomOutput {
  const name = validateName(input.hostName);
  const hostId = randomUUID();
  const host: Player = { id: hostId, name, seat: 1, connected: true, disconnectedAt: null };

  const room: RoomServerState = {
    code: generateUniqueRoomCode(),
    hostId,
    phase: 'lobby',
    players: [host],
    chat: [
      { id: randomUUID(), authorId: null, authorName: null, text: `${name} created the room`, ts: Date.now() },
    ],
    createdAt: Date.now(),
    game: null,
    hands: null,
  };

  rooms.set(room.code, room);
  return { room, sessionId: hostId };
}

export function getRoom(code: string): RoomServerState | undefined {
  return rooms.get(code);
}

export interface JoinRoomInput {
  code: string;
  name: string;
}

export function joinRoom(input: JoinRoomInput): JoinRoomResult {
  const room = rooms.get(input.code);
  if (!room) return { ok: false, error: 'NOT_FOUND' };

  let name: string;
  try {
    name = validateName(input.name);
  } catch {
    return { ok: false, error: 'NAME_INVALID' };
  }

  if (room.players.length >= MAX_PLAYERS) {
    return { ok: false, error: 'FULL' };
  }
  if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'NAME_TAKEN' };
  }

  const seat = (room.players.length + 1) as 1 | 2 | 3 | 4;
  const id = randomUUID();
  const player: Player = { id, name, seat, connected: true, disconnectedAt: null };
  room.players.push(player);
  room.chat.push({
    id: randomUUID(),
    authorId: null,
    authorName: null,
    text: `${name} joined`,
    ts: Date.now(),
  });

  // JoinRoomResult wire shape uses RoomView (public). Project through toRoomView so
  // server-only fields like `hands` are stripped — never leak them on the wire.
  return { ok: true, sessionId: id, room: toRoomView(room) };
}

type LeaveRoomResult =
  | { ok: true; room: RoomServerState; wasLastPlayer: false }
  | { ok: true; room: null; wasLastPlayer: true }
  | { ok: false; error: 'NOT_FOUND' | 'NOT_IN_ROOM' };

export interface LeaveRoomInput {
  code: string;
  sessionId: string;
}

export function leaveRoom(input: LeaveRoomInput): LeaveRoomResult {
  const room = rooms.get(input.code);
  if (!room) return { ok: false, error: 'NOT_FOUND' };

  const idx = room.players.findIndex((p) => p.id === input.sessionId);
  if (idx === -1) return { ok: false, error: 'NOT_IN_ROOM' };

  const leaver = room.players[idx];
  room.players.splice(idx, 1);

  if (room.players.length === 0) {
    rooms.delete(room.code);
    return { ok: true, room: null, wasLastPlayer: true };
  }

  // Reshuffle seats so they stay contiguous starting at 1.
  room.players.forEach((p, i) => {
    p.seat = (i + 1) as 1 | 2 | 3 | 4;
  });

  // Transfer host if the leaver was the host.
  if (room.hostId === input.sessionId) {
    room.hostId = room.players[0].id;
  }

  room.chat.push({
    id: randomUUID(),
    authorId: null,
    authorName: null,
    text: `${leaver.name} left`,
    ts: Date.now(),
  });

  return { ok: true, room, wasLastPlayer: false };
}

type PostChatResult =
  | { ok: true; room: RoomServerState }
  | { ok: false; error: 'NOT_FOUND' | 'NOT_IN_ROOM' | 'INVALID_TEXT' };

export interface PostChatInput {
  code: string;
  sessionId: string;
  text: string;
}

const MAX_CHAT_LENGTH = 200;

export function postChat(input: PostChatInput): PostChatResult {
  const room = rooms.get(input.code);
  if (!room) return { ok: false, error: 'NOT_FOUND' };

  const player = room.players.find((p) => p.id === input.sessionId);
  if (!player) return { ok: false, error: 'NOT_IN_ROOM' };

  const text = input.text.trim();
  if (text.length === 0 || text.length > MAX_CHAT_LENGTH) {
    return { ok: false, error: 'INVALID_TEXT' };
  }

  room.chat.push({
    id: randomUUID(),
    authorId: player.id,
    authorName: player.name,
    text,
    ts: Date.now(),
  });

  return { ok: true, room };
}

export interface StartGameInput {
  code: string;
  sessionId: string;
}

/**
 * Server-only return shape — richer than the wire `StartGameResult` because
 * the socket layer needs the updated room to broadcast it. Wire response to
 * the client is still `{ ok: true }` / `{ ok: false; error }` per the shared
 * type; the room comes through `room:state` instead.
 */
type StartGameInternalResult =
  | { ok: true; room: RoomServerState }
  | { ok: false; error: 'NOT_HOST' | 'NEED_FOUR' };

export function startGame(input: StartGameInput): StartGameInternalResult {
  const room = rooms.get(input.code);
  if (!room) return { ok: false, error: 'NOT_HOST' }; // unknown room treated as not-authorized

  if (room.hostId !== input.sessionId) return { ok: false, error: 'NOT_HOST' };
  if (room.players.length < MAX_PLAYERS) return { ok: false, error: 'NEED_FOUR' };

  const deck = shuffle(createDeck());
  room.hands = deal(deck);
  room.game = {
    bid: emptyBidState(),
    trumpPartner: null,
    currentTrick: null,
    completedTricks: [],
    partnerSeat: null,
    revealedPartnerSeat: null,
  };
  room.phase = 'bidding';

  return { ok: true, room };
}

export interface SetConnectedInput {
  code: string;
  sessionId: string;
  connected: boolean;
}

export function setConnected(input: SetConnectedInput): void {
  const room = rooms.get(input.code);
  if (!room) return;
  const player = room.players.find((p) => p.id === input.sessionId);
  if (!player) return;
  player.connected = input.connected;
}

type BidInRoomResult =
  | { ok: true; room: RoomServerState }
  | { ok: false; error: 'NOT_IN_GAME' | 'INVALID_AMOUNT' | 'NOT_HIGHER' | 'ALREADY_BIDDER' | 'NO_BID_TO_PASS' };

export function placeBidInRoom(input: { code: string; seat: Seat; amount: number }): BidInRoomResult {
  const room = rooms.get(input.code);
  if (!room || !room.game || room.phase !== 'bidding') {
    return { ok: false, error: 'NOT_IN_GAME' };
  }
  const res = placeBid(room.game.bid, input.seat, input.amount);
  if (!res.ok) return { ok: false, error: res.error as BidInRoomResult extends { ok: false; error: infer E } ? E : never };
  room.game.bid = res.state;
  return { ok: true, room };
}

export function passBidInRoom(input: { code: string; seat: Seat }): BidInRoomResult {
  const room = rooms.get(input.code);
  if (!room || !room.game || room.phase !== 'bidding') {
    return { ok: false, error: 'NOT_IN_GAME' };
  }
  const res = passBid(room.game.bid, input.seat);
  if (!res.ok) return { ok: false, error: res.error as BidInRoomResult extends { ok: false; error: infer E } ? E : never };
  room.game.bid = res.state;
  if (res.justCompleted) {
    room.phase = 'trump_partner';
  }
  return { ok: true, room };
}

type TrumpPartnerInRoomResult =
  | { ok: true; room: RoomServerState }
  | { ok: false; error: 'NOT_BIDDER' | 'INVALID_CARD' | 'OWN_CARD' | 'NOT_IN_GAME' };

export function chooseTrumpPartnerInRoom(input: {
  code: string;
  seat: Seat;
  trump: Suit;
  calledCard: Card;
}): TrumpPartnerInRoomResult {
  const room = rooms.get(input.code);
  if (!room || !room.game || room.phase !== 'trump_partner' || !room.hands) {
    return { ok: false, error: 'NOT_IN_GAME' };
  }
  const bidderSeat = room.game.bid.currentBidderSeat;
  if (bidderSeat === null || bidderSeat !== input.seat) {
    return { ok: false, error: 'NOT_BIDDER' };
  }

  const v = validateTrumpPartnerChoice({
    bidderSeat,
    hands: room.hands,
    trump: input.trump,
    calledCard: input.calledCard,
  });
  if (!v.ok) return { ok: false, error: v.error };

  room.game.trumpPartner = { trump: input.trump, calledCard: input.calledCard };
  room.game.partnerSeat = v.partnerSeat;
  room.game.currentTrick = startTrick(bidderSeat); // bidder leads first trick
  room.phase = 'play';
  return { ok: true, room };
}

type PlayAgainInRoomResult =
  | { ok: true; room: RoomServerState }
  | { ok: false; error: 'NOT_HOST' | 'NOT_IN_END' };

export function playAgainInRoom(input: { code: string; sessionId: string }): PlayAgainInRoomResult {
  const room = rooms.get(input.code);
  if (!room) return { ok: false, error: 'NOT_HOST' }; // treat unknown as not-host
  if (room.hostId !== input.sessionId) return { ok: false, error: 'NOT_HOST' };
  if (room.phase !== 'end') return { ok: false, error: 'NOT_IN_END' };

  // Reset to lobby state — keep players + seats + chat.
  room.phase = 'lobby';
  room.game = null;
  room.hands = null;
  room.chat.push({
    id: randomUUID(),
    authorId: null,
    authorName: null,
    text: 'New game starting…',
    ts: Date.now(),
  });

  return { ok: true, room };
}

type PlayCardInRoomResult =
  | { ok: true; room: RoomServerState }
  | { ok: false; error: 'NOT_YOUR_TURN' | 'NOT_IN_HAND' | 'MUST_FOLLOW_SUIT' | 'NOT_IN_GAME' };

export function playCardInRoom(input: { code: string; seat: Seat; card: Card }): PlayCardInRoomResult {
  const room = rooms.get(input.code);
  if (
    !room ||
    !room.game ||
    room.phase !== 'play' ||
    !room.hands ||
    !room.game.currentTrick ||
    !room.game.trumpPartner
  ) {
    return { ok: false, error: 'NOT_IN_GAME' };
  }

  const trick = room.game.currentTrick;

  // Whose turn? Clockwise from ledBy.
  const nextSeatIndex = (trick.ledBy - 1 + trick.plays.length) % 4;
  const expectedSeat = (nextSeatIndex + 1) as Seat;
  if (input.seat !== expectedSeat) return { ok: false, error: 'NOT_YOUR_TURN' };

  const hand = room.hands[input.seat];
  const inHand = hand.some((c) => cardKey(c) === cardKey(input.card));
  if (!inHand) return { ok: false, error: 'NOT_IN_HAND' };

  if (!isLegalPlay(trick, hand, input.card)) {
    return { ok: false, error: 'MUST_FOLLOW_SUIT' };
  }

  // Remove from hand and add to trick.
  room.hands[input.seat] = hand.filter((c) => cardKey(c) !== cardKey(input.card));
  const r = playCardInTrick(trick, input.seat, input.card);
  if (!r.ok) return { ok: false, error: 'NOT_IN_GAME' }; // shouldn't happen
  room.game.currentTrick = r.trick;

  // Reveal partner if the called card just got played.
  const called = room.game.trumpPartner.calledCard;
  if (cardKey(input.card) === cardKey(called)) {
    room.game.revealedPartnerSeat = input.seat;
  }

  // If trick complete, resolve and start next OR advance to end.
  if (r.complete) {
    const winnerSeat = resolveTrick(r.trick, room.game.trumpPartner.trump);
    const finished: CompletedTrick = {
      ledBy: r.trick.ledBy,
      ledSuit: r.trick.ledSuit!,
      plays: r.trick.plays,
      winnerSeat,
    };
    room.game.completedTricks.push(finished);

    if (room.game.completedTricks.length === 13) {
      // Defensive: by 13 tricks the called card must have been played, but ensure
      // the public projection has the partner seat set in case logic upstream
      // changes.
      if (room.game.revealedPartnerSeat === null) {
        room.game.revealedPartnerSeat = room.game.partnerSeat;
      }
      room.phase = 'end';
      room.game.currentTrick = null;
    } else {
      room.game.currentTrick = startTrick(winnerSeat);
    }
  }

  return { ok: true, room };
}
