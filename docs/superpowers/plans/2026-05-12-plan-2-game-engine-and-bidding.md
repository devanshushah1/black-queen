# Black Queen — Plan 2: Game Engine + Bidding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the host clicks Start, the deck is shuffled, 13 cards are dealt to each player, the game transitions to the **bidding phase**, and each player sees only their own hand. Players can place bids (fastest-finger-first, in +5 increments, minimum 75) and pass; when 3 non-bidders have passed against the current high bid, bidding ends and the game transitions to a placeholder `trump_partner` phase (Plan 3 will fill it in).

**Architecture:** A new `src/server/game/` directory hosts pure-logic modules: `deck.ts` (deck + shuffle + deal), `bidding.ts` (the bidding state machine). The `Room` type gets an optional `game` field carrying `bid` state and a server-only `hands` map (one hand per seat). The wire protocol gains two new shapes: `room:state` keeps broadcasting public state (room without `hands`), and a new server-to-client event `hand:update` is emitted per-socket with that player's private hand. The client adds private hand state to the Zustand store and renders the bidding UI when `room.phase === 'bidding'`. The `/game-starting` placeholder is removed; `/room/[code]` becomes the canvas that switches content based on phase.

**Tech Stack:** Unchanged from Plan 1 (Next.js 14 App Router, Socket.IO 4.8, Zustand, Tailwind, Vitest, Playwright, TypeScript 5).

**Out of scope (Plans 3-5):** trump suit / partner card selection, trick play, end-of-game scoring, disconnect/reconnect with hand recovery.

---

## File map

```
black-queen/
├── src/
│   ├── shared/
│   │   └── types.ts                       # MODIFY: add Card, GameState, Bid types, hand:update event
│   ├── server/
│   │   ├── rooms.ts                       # MODIFY: integrate game state into Room
│   │   ├── socket.ts                      # MODIFY: hand:update on start, bid:place/bid:pass handlers
│   │   └── game/
│   │       ├── deck.ts                    # NEW: cards, shuffle, deal
│   │       ├── bidding.ts                 # NEW: bidding state machine
│   │       └── view.ts                    # NEW: per-recipient projection (strip hands from broadcast)
│   ├── client/
│   │   ├── store.ts                       # MODIFY: yourHand state + setHand action
│   │   └── useSocket.ts                   # MODIFY: subscribe to hand:update
│   ├── components/
│   │   ├── bidding/                       # NEW directory
│   │   │   ├── BidPanel.tsx               # NEW: center-stage bidding panel
│   │   │   ├── StatusPill.tsx             # NEW: per-seat status (live/bid X/passed)
│   │   │   └── HandPreview.tsx            # NEW: small inactive hand for the bidder
│   │   └── Card.tsx                       # NEW: single playing card visual (face up)
│   └── app/
│       ├── room/[code]/page.tsx           # MODIFY: route on phase; render bidding UI when phase=bidding
│       └── game-starting/                 # DELETE: no longer needed
└── tests/
    ├── unit/
    │   ├── deck.test.ts                   # NEW
    │   ├── bidding.test.ts                # NEW
    │   └── socket.test.ts                 # MODIFY: bidding socket tests
    └── e2e/
        └── bidding.spec.ts                # NEW: 4-player Playwright bidding flow
```

Why these boundaries:
- **`deck.ts` and `bidding.ts` are pure** — no I/O, no socket dependencies. Both are unit-testable with Vitest.
- **`view.ts` owns the "strip hidden info from broadcast" responsibility.** Centralizing it means later plans (trump/partner reveal logic) can extend the same function without scattering filter calls across the socket handlers.
- **`Card.tsx`** is a small (~40 line) visual primitive that will be reused in Plan 3 (table view) and Plan 4 (results). Add it now so Plan 2's `HandPreview` can use it.
- **No new page route.** `/room/[code]` already handles "show waiting room when in lobby"; we extend it with "show bidding panel when in bidding". This keeps URL stable across game phases.

---

## Task 1: Card types + Card component

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/components/Card.tsx`

- [ ] **Step 1: Add Card types to shared/types.ts**

Append to `src/shared/types.ts` (above the constants block):

```typescript
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
```

- [ ] **Step 2: Verify typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Create the Card component**

Create `src/components/Card.tsx`:

```tsx
import type { Card as CardType } from '@/shared/types';

interface CardProps {
  card: CardType;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_GLYPH: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SIZE_CLASSES: Record<NonNullable<CardProps['size']>, { w: string; h: string; rank: string; suit: string; center: string }> = {
  sm: { w: 'w-10', h: 'h-14', rank: 'text-xs', suit: 'text-[10px]', center: 'text-xl' },
  md: { w: 'w-14', h: 'h-20', rank: 'text-sm', suit: 'text-xs', center: 'text-2xl' },
  lg: { w: 'w-16 sm:w-[68px]', h: 'h-24', rank: 'text-base', suit: 'text-sm', center: 'text-3xl' },
};

export function Card({ card, size = 'md' }: CardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const colorClass = isRed ? 'text-cardred' : 'text-cardblack';
  const s = SIZE_CLASSES[size];
  const glyph = SUIT_GLYPH[card.suit];

  return (
    <div className={`${s.w} ${s.h} bg-white rounded-md shadow-md relative font-serif select-none ${colorClass}`}>
      <div className={`absolute top-1 left-1.5 ${s.rank} font-bold leading-none`}>
        {card.rank}
        <span className={`block ${s.suit}`}>{glyph}</span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center ${s.center}`}>{glyph}</div>
      <div className={`absolute bottom-1 right-1.5 ${s.rank} font-bold leading-none rotate-180`}>
        {card.rank}
        <span className={`block ${s.suit}`}>{glyph}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TS + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/components/Card.tsx
git commit -m "Add Card type, point value helper, and Card visual component"
```

(No `Co-Authored-By` trailer.)

---

## Task 2: Deck module — create + shuffle + deal

**Files:**
- Create: `src/server/game/deck.ts`
- Create: `tests/unit/deck.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/deck.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, deal, totalPoints } from '@/server/game/deck';
import { SUITS, RANKS, pointValue, cardKey } from '@/shared/types';

describe('createDeck', () => {
  it('returns 52 unique cards (4 suits × 13 ranks)', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const keys = new Set(deck.map(cardKey));
    expect(keys.size).toBe(52);
  });

  it('contains every (suit, rank) combination', () => {
    const deck = createDeck();
    const keys = new Set(deck.map(cardKey));
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        expect(keys.has(`${rank}-${suit}`)).toBe(true);
      }
    }
  });
});

describe('shuffle', () => {
  it('returns 52 cards (no duplicates, no losses)', () => {
    const shuffled = shuffle(createDeck());
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map(cardKey)).size).toBe(52);
  });

  it('produces different orderings with different seeds', () => {
    const a = shuffle(createDeck(), () => 0.1);
    const b = shuffle(createDeck(), () => 0.9);
    const aKey = a.map(cardKey).join(',');
    const bKey = b.map(cardKey).join(',');
    expect(aKey).not.toBe(bKey);
  });

  it('is deterministic with the same rng', () => {
    const rng = () => 0.5;
    const a = shuffle(createDeck(), rng);
    const b = shuffle(createDeck(), rng);
    expect(a.map(cardKey)).toEqual(b.map(cardKey));
  });
});

describe('deal', () => {
  it('deals 13 cards to each of 4 seats', () => {
    const hands = deal(createDeck());
    expect(Object.keys(hands).sort()).toEqual(['1', '2', '3', '4']);
    for (const seat of [1, 2, 3, 4] as const) {
      expect(hands[seat]).toHaveLength(13);
    }
  });

  it('deals all 52 cards across the 4 hands with no overlap', () => {
    const hands = deal(createDeck());
    const all = [...hands[1], ...hands[2], ...hands[3], ...hands[4]];
    expect(all).toHaveLength(52);
    expect(new Set(all.map(cardKey)).size).toBe(52);
  });

  it('throws if given a deck without 52 cards', () => {
    expect(() => deal([])).toThrow(/expected 52/i);
    expect(() => deal(createDeck().slice(0, 50))).toThrow(/expected 52/i);
  });
});

describe('totalPoints', () => {
  it('a full deck totals 150 points', () => {
    expect(totalPoints(createDeck())).toBe(150);
  });

  it('a single 5 is 5, a single 10 is 10, a single Ace is 15, Q♠ is 30', () => {
    expect(pointValue({ suit: 'hearts', rank: '5' })).toBe(5);
    expect(pointValue({ suit: 'clubs', rank: '10' })).toBe(10);
    expect(pointValue({ suit: 'diamonds', rank: 'A' })).toBe(15);
    expect(pointValue({ suit: 'spades', rank: 'Q' })).toBe(30);
    expect(pointValue({ suit: 'hearts', rank: 'Q' })).toBe(0);
    expect(pointValue({ suit: 'spades', rank: '7' })).toBe(0);
  });
});
```

Run: `npm test` → expect failure (`@/server/game/deck` module not found).

- [ ] **Step 2: Implement the deck module**

Create `src/server/game/deck.ts`:

```typescript
import {
  type Card,
  type Suit,
  type Rank,
  SUITS,
  RANKS,
  pointValue,
} from '@/shared/types';

/** Returns a fresh, unshuffled 52-card deck in stable suit-major order. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle. Returns a NEW array; does not mutate input.
 *
 * @param rng optional random source (defaults to Math.random) — injecting an rng
 *            lets tests be deterministic.
 */
export function shuffle(deck: Card[], rng: () => number = Math.random): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type SeatHands = Record<1 | 2 | 3 | 4, Card[]>;

/** Deals 13 cards to each of seats 1-4 in round-robin order. */
export function deal(deck: Card[]): SeatHands {
  if (deck.length !== 52) {
    throw new Error(`Cannot deal: expected 52 cards, got ${deck.length}`);
  }
  const hands: SeatHands = { 1: [], 2: [], 3: [], 4: [] };
  for (let i = 0; i < deck.length; i++) {
    const seat = ((i % 4) + 1) as 1 | 2 | 3 | 4;
    hands[seat].push(deck[i]);
  }
  return hands;
}

/** Sum of point values in a card collection. */
export function totalPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + pointValue(c), 0);
}
```

- [ ] **Step 3: Run tests; expect them to pass**

Run: `npm test`
Expected: previous 37 + new 11 = 48 pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/game/deck.ts tests/unit/deck.test.ts
git commit -m "Add deck module: createDeck, shuffle, deal, totalPoints"
```

(No `Co-Authored-By`.)

---

## Task 3: Bidding state machine

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/server/game/bidding.ts`
- Create: `tests/unit/bidding.test.ts`

- [ ] **Step 1: Add Bid types to shared/types.ts**

Append to `src/shared/types.ts`:

```typescript
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
```

Add these to `ClientToServerEvents` (modify existing interface, do NOT duplicate):

```typescript
  'bid:place':  (payload: { amount: number }, cb: (res: BidActionAck) => void) => void;
  'bid:pass':   (cb: (res: BidActionAck) => void) => void;
```

And add the supporting result type near the other result types:

```typescript
/** Wire-format ack for bid:place and bid:pass. */
export type BidActionAck =
  | { ok: true }
  | { ok: false; error: 'INVALID_AMOUNT' | 'NOT_HIGHER' | 'ALREADY_BIDDER' | 'NO_BID_TO_PASS' | 'NOT_IN_GAME' | 'NOT_IN_ROOM' };
```

- [ ] **Step 2: Write failing tests**

Create `tests/unit/bidding.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emptyBidState, placeBid, passBid, isBiddingComplete } from '@/server/game/bidding';

describe('emptyBidState', () => {
  it('returns null bid, no bidder, no passes, not complete', () => {
    const s = emptyBidState();
    expect(s.currentBid).toBeNull();
    expect(s.currentBidderSeat).toBeNull();
    expect(s.passedSeats).toEqual([]);
    expect(s.complete).toBe(false);
  });
});

describe('placeBid', () => {
  it('accepts a valid opening bid (75, by seat 2)', () => {
    const res = placeBid(emptyBidState(), 2, 75);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.currentBid).toBe(75);
    expect(res.state.currentBidderSeat).toBe(2);
    expect(res.state.passedSeats).toEqual([]);
    expect(res.justCompleted).toBe(false);
  });

  it('rejects below minimum bid (74)', () => {
    const res = placeBid(emptyBidState(), 1, 74);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_AMOUNT');
  });

  it('rejects above maximum bid (155)', () => {
    const res = placeBid(emptyBidState(), 1, 155);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_AMOUNT');
  });

  it('rejects non-multiple-of-5 amount (78)', () => {
    const res = placeBid(emptyBidState(), 1, 78);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_AMOUNT');
  });

  it('rejects a follow-up bid that is not higher than current', () => {
    const after = placeBid(emptyBidState(), 1, 90);
    if (!after.ok) throw new Error('precondition');
    const res = placeBid(after.state, 2, 90);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NOT_HIGHER');
  });

  it('accepts a higher follow-up bid and resets passedSeats', () => {
    let state = emptyBidState();
    state = (placeBid(state, 1, 90) as any).state;
    state = (passBid(state, 2) as any).state;
    state = (passBid(state, 3) as any).state;
    expect(state.passedSeats).toEqual([2, 3]);
    const res = placeBid(state, 4, 95);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.currentBid).toBe(95);
    expect(res.state.currentBidderSeat).toBe(4);
    expect(res.state.passedSeats).toEqual([]); // reset on raise
  });

  it('allows the current bidder to self-raise', () => {
    const a = placeBid(emptyBidState(), 1, 90);
    if (!a.ok) throw new Error('precondition');
    const b = placeBid(a.state, 1, 95);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.state.currentBidderSeat).toBe(1);
    expect(b.state.currentBid).toBe(95);
  });
});

describe('passBid', () => {
  it('rejects pass when there is no bid yet', () => {
    const res = passBid(emptyBidState(), 1);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NO_BID_TO_PASS');
  });

  it('rejects pass by the current bidder', () => {
    const a = placeBid(emptyBidState(), 1, 90);
    if (!a.ok) throw new Error('precondition');
    const res = passBid(a.state, 1);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('ALREADY_BIDDER');
  });

  it('adds the seat to passedSeats once (idempotent)', () => {
    const a = placeBid(emptyBidState(), 1, 90);
    if (!a.ok) throw new Error('precondition');
    let s = a.state;
    s = (passBid(s, 2) as any).state;
    s = (passBid(s, 2) as any).state; // idempotent
    expect(s.passedSeats).toEqual([2]);
  });

  it('marks complete + justCompleted when 3 non-bidders have passed', () => {
    const a = placeBid(emptyBidState(), 1, 90);
    if (!a.ok) throw new Error('precondition');
    let s = a.state;
    let r = passBid(s, 2);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.justCompleted).toBe(false);
    s = r.state;

    r = passBid(s, 3);
    if (!r.ok) return;
    expect(r.justCompleted).toBe(false);
    s = r.state;

    r = passBid(s, 4);
    if (!r.ok) return;
    expect(r.justCompleted).toBe(true);
    expect(r.state.complete).toBe(true);
  });
});

describe('isBiddingComplete', () => {
  it('false on empty state', () => {
    expect(isBiddingComplete(emptyBidState())).toBe(false);
  });

  it('true once 3 non-bidder seats have passed', () => {
    const a = placeBid(emptyBidState(), 2, 90);
    if (!a.ok) throw new Error('precondition');
    let s = a.state;
    s = (passBid(s, 1) as any).state;
    s = (passBid(s, 3) as any).state;
    s = (passBid(s, 4) as any).state;
    expect(isBiddingComplete(s)).toBe(true);
  });
});
```

Run: `npm test` → expect 11 new failures.

- [ ] **Step 3: Implement the bidding module**

Create `src/server/game/bidding.ts`:

```typescript
import {
  type BidState,
  type Seat,
  type BidActionResult,
  MIN_BID,
  MAX_BID,
  BID_INCREMENT,
} from '@/shared/types';

export function emptyBidState(): BidState {
  return { currentBid: null, currentBidderSeat: null, passedSeats: [], complete: false };
}

function isValidAmount(amount: number): boolean {
  if (!Number.isInteger(amount)) return false;
  if (amount < MIN_BID || amount > MAX_BID) return false;
  if (amount % BID_INCREMENT !== 0) return false;
  return true;
}

/** Place a bid. Returns the new state, or an error if invalid. */
export function placeBid(state: BidState, seat: Seat, amount: number): BidActionResult {
  if (state.complete) return { ok: false, error: 'NOT_IN_GAME' };
  if (!isValidAmount(amount)) return { ok: false, error: 'INVALID_AMOUNT' };
  if (state.currentBid !== null && amount <= state.currentBid) {
    return { ok: false, error: 'NOT_HIGHER' };
  }

  const newState: BidState = {
    currentBid: amount,
    currentBidderSeat: seat,
    passedSeats: [], // any new bid resets all passes
    complete: false,
  };
  return { ok: true, state: newState, justCompleted: false };
}

/** Pass on the current bid. Returns the new state. */
export function passBid(state: BidState, seat: Seat): BidActionResult {
  if (state.complete) return { ok: false, error: 'NOT_IN_GAME' };
  if (state.currentBid === null) return { ok: false, error: 'NO_BID_TO_PASS' };
  if (state.currentBidderSeat === seat) return { ok: false, error: 'ALREADY_BIDDER' };

  const passedSeats = state.passedSeats.includes(seat)
    ? state.passedSeats
    : [...state.passedSeats, seat];

  const otherSeats: Seat[] = [1, 2, 3, 4].filter((s) => s !== state.currentBidderSeat) as Seat[];
  const allPassed = otherSeats.every((s) => passedSeats.includes(s));
  const newState: BidState = {
    ...state,
    passedSeats,
    complete: allPassed,
  };
  return { ok: true, state: newState, justCompleted: allPassed && !state.complete };
}

/** Pure predicate. */
export function isBiddingComplete(state: BidState): boolean {
  return state.complete;
}
```

- [ ] **Step 4: Run tests; expect them to pass**

Run: `npm test`
Expected: 48 + 11 = 59 pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/server/game/bidding.ts tests/unit/bidding.test.ts
git commit -m "Add bidding state machine: placeBid, passBid, isBiddingComplete"
```

---

## Task 4: Per-recipient room projection (hide hands)

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/server/game/view.ts`
- Create: `tests/unit/view.test.ts`

- [ ] **Step 1: Add GameState + RoomView types**

Append to `src/shared/types.ts`:

```typescript
// =========================================================================
// Game state (added to Room when phase moves past 'lobby')
// =========================================================================

export interface GameState {
  bid: BidState;
}

/** Server-internal: full Room state including private hands. */
export interface RoomServerState extends Room {
  game: GameState | null;
  /** Server-only. Each player's 13 cards. Never broadcast directly. */
  hands: Record<Seat, Card[]> | null;
}

/**
 * Wire format sent to clients. Public state — no `hands` field.
 * Each socket additionally receives its own `hand` via the `hand:update` event.
 */
export interface RoomView {
  code: string;
  hostId: string;
  phase: GamePhase;
  players: Player[];
  chat: ChatMessage[];
  createdAt: number;
  game: GameState | null;
}
```

Update the existing `Room` interface to no longer mention `game`/`hands` at the public level — those move into `RoomServerState` and the broadcast strips them.

Wait — the existing `Room` interface doesn't have `game` or `hands` yet, so we don't need to remove anything. Instead, we KEEP `Room` as the public shape (rename usages later) and have `RoomServerState` extend it for server use.

Actually the cleanest approach: leave the `Room` type unchanged (public shape), introduce `RoomServerState` as a superset with private fields. The room manager stores `RoomServerState` internally and broadcasts `Room`/`RoomView`.

Reconcile the two types by aligning their public field lists. Look at the existing `Room`:

```typescript
export interface Room {
  code: string;
  hostId: string;
  phase: GamePhase;
  players: Player[];
  chat: ChatMessage[];
  createdAt: number;
}
```

`RoomView` extends `Room` with `game: GameState | null`. Replace the explicit `RoomView` definition above with:

```typescript
export interface RoomView extends Room {
  game: GameState | null;
}

export interface RoomServerState extends RoomView {
  /** Server-only. Each player's 13 cards. Never broadcast directly. */
  hands: Record<Seat, Card[]> | null;
}
```

And update the wire event signature for `room:state` to use `RoomView`:

```typescript
export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void;
  'room:error': (payload: { code: 'NOT_FOUND' | 'FULL' | 'NAME_TAKEN' | 'NOT_HOST' | 'NEED_FOUR'; message: string }) => void;
  'hand:update': (payload: { hand: Card[] }) => void;
}
```

(Added `hand:update` for delivering each player's private hand.)

- [ ] **Step 2: Write failing tests**

Create `tests/unit/view.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toRoomView } from '@/server/game/view';
import type { RoomServerState, Card } from '@/shared/types';

const aceHearts: Card = { suit: 'hearts', rank: 'A' };
const fivelubs: Card = { suit: 'clubs', rank: '5' };

const sampleServerState: RoomServerState = {
  code: 'ABCD',
  hostId: 'h1',
  phase: 'bidding',
  players: [
    { id: 'h1', name: 'Dev', seat: 1, connected: true },
    { id: 'p2', name: 'Sam', seat: 2, connected: true },
    { id: 'p3', name: 'Riya', seat: 3, connected: true },
    { id: 'p4', name: 'Aman', seat: 4, connected: true },
  ],
  chat: [],
  createdAt: 1,
  game: { bid: { currentBid: 90, currentBidderSeat: 1, passedSeats: [2], complete: false } },
  hands: {
    1: [aceHearts],
    2: [fivelubs],
    3: [],
    4: [],
  },
};

describe('toRoomView', () => {
  it('strips the hands field from the server state', () => {
    const view = toRoomView(sampleServerState);
    expect('hands' in view).toBe(false);
  });

  it('preserves all public fields (code, hostId, phase, players, chat, createdAt, game)', () => {
    const view = toRoomView(sampleServerState);
    expect(view.code).toBe('ABCD');
    expect(view.hostId).toBe('h1');
    expect(view.phase).toBe('bidding');
    expect(view.players).toHaveLength(4);
    expect(view.chat).toEqual([]);
    expect(view.createdAt).toBe(1);
    expect(view.game?.bid.currentBid).toBe(90);
  });
});
```

Run: `npm test` → expect failure.

- [ ] **Step 3: Implement toRoomView**

Create `src/server/game/view.ts`:

```typescript
import type { RoomServerState, RoomView } from '@/shared/types';

/** Strip server-only fields from a Room. Safe to broadcast over a socket. */
export function toRoomView(state: RoomServerState): RoomView {
  const { hands: _hands, ...view } = state;
  return view;
}
```

Run `npm test` → all should pass.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/server/game/view.ts tests/unit/view.test.ts
git commit -m "Add RoomView projection that strips server-only hands field"
```

---

## Task 5: Integrate game state into Room manager

**Files:**
- Modify: `src/server/rooms.ts`
- Modify: `tests/unit/rooms.test.ts`

This task widens the internal `Room` storage from plain `Room` to `RoomServerState` so that `startGame` can attach a shuffled deck. The public broadcast still emits the projected `RoomView` (Task 4 does the stripping).

- [ ] **Step 1: Update tests for the new startGame behavior**

Modify `tests/unit/rooms.test.ts`. Find the `startGame` describe block. Add a new test inside it:

```typescript
it('deals 13 cards to each seat and initializes empty bid state', () => {
  const { room, sessionId: hostId } = createRoom({ hostName: 'Dev' });
  joinRoom({ code: room.code, name: 'Sam' });
  joinRoom({ code: room.code, name: 'Riya' });
  joinRoom({ code: room.code, name: 'Aman' });

  const res = startGame({ code: room.code, sessionId: hostId });
  expect(res.ok).toBe(true);
  if (!res.ok) return;

  expect(res.room.game).not.toBeNull();
  expect(res.room.game!.bid.currentBid).toBeNull();
  expect(res.room.hands).not.toBeNull();
  expect(Object.keys(res.room.hands!).sort()).toEqual(['1', '2', '3', '4']);
  for (const seat of [1, 2, 3, 4] as const) {
    expect(res.room.hands![seat]).toHaveLength(13);
  }
});
```

Run: `npm test` → expect the new test to fail (room.game / room.hands not defined).

- [ ] **Step 2: Update the Room internal type and startGame**

In `src/server/rooms.ts`:

1. Update the import block:

```typescript
import {
  type RoomServerState as Room,   // alias to keep code below unchanged
  type Player,
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  ROOM_CODE_LENGTH,
} from '@/shared/types';
```

Wait — aliasing is risky if it confuses readers. Better: rename the internal Map and helper to use the new type explicitly. Replace the import block entirely with:

```typescript
import { randomUUID } from 'node:crypto';
import {
  type RoomServerState,
  type RoomView,
  type Player,
  type Seat,
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  MAX_PLAYERS,
  ROOM_CODE_LENGTH,
} from '@/shared/types';
import { createDeck, shuffle, deal } from './game/deck';
import { emptyBidState } from './game/bidding';
```

2. Change the rooms Map type:

```typescript
const rooms = new Map<string, RoomServerState>();
```

3. Wherever the code references `Room` as a type for the stored value, replace with `RoomServerState`. Specifically the `createRoom` function:

```typescript
export function createRoom(input: CreateRoomInput): CreateRoomOutput {
  const name = validateName(input.hostName);
  const hostId = randomUUID();
  const host: Player = { id: hostId, name, seat: 1, connected: true };

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
```

4. Update the return shapes for `joinRoom`, `leaveRoom`, etc. to use `RoomServerState`. Since `RoomServerState extends Room`, this is mostly a type-only change. Replace each `Room` reference in return types with `RoomServerState` and adjust the corresponding `CreateRoomOutput` etc. interfaces accordingly:

```typescript
export interface CreateRoomOutput {
  room: RoomServerState;
  sessionId: string;
}
```

For `JoinRoomResult` (a discriminated union defined in shared/types), the existing shape `{ ok: true; sessionId; room: Room }` — leave it as `Room` (public shape) because the wire format expects Room. The server-internal call sites that need the full state will keep a reference to the room from `rooms.get(code)` directly.

Concretely: `joinRoom` keeps its return type as `JoinRoomResult` (with `room: Room`). At the call site in `socket.ts` we already pass `res.room` to broadcast — that's fine because it's the public `Room` shape.

Wait — the test added in Step 1 accesses `res.room.game` and `res.room.hands`. For that to typecheck, the test expects `startGame` to return `RoomServerState`. Let me adjust the internal `StartGameInternalResult` to use `RoomServerState`:

```typescript
type StartGameInternalResult =
  | { ok: true; room: RoomServerState }
  | { ok: false; error: 'NOT_HOST' | 'NEED_FOUR' };
```

5. Implement the deck-and-deal portion of `startGame`:

```typescript
export function startGame(input: StartGameInput): StartGameInternalResult {
  const room = rooms.get(input.code);
  if (!room) return { ok: false, error: 'NOT_HOST' };

  if (room.hostId !== input.sessionId) return { ok: false, error: 'NOT_HOST' };
  if (room.players.length < MAX_PLAYERS) return { ok: false, error: 'NEED_FOUR' };

  // Shuffle a fresh deck and deal 13 cards to each seat.
  const deck = shuffle(createDeck());
  room.hands = deal(deck);
  room.game = { bid: emptyBidState() };
  room.phase = 'bidding';

  return { ok: true, room };
}
```

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: all 60 tests pass (59 from earlier + 1 new in rooms.test.ts). If any prior test fails because it accessed `room.game` or `room.hands` on a fresh lobby room (which is `null`), update the test to expect `null`.

- [ ] **Step 4: Verify TS clean**

Run: `npx tsc --noEmit`
Expected: 0.

- [ ] **Step 5: Commit**

```bash
git add src/server/rooms.ts tests/unit/rooms.test.ts src/shared/types.ts
git commit -m "Integrate game state into Room: startGame deals hands and inits bid"
```

---

## Task 6: Socket handlers — hand:update + bidding events

**Files:**
- Modify: `src/server/socket.ts`
- Modify: `tests/unit/socket.test.ts`

- [ ] **Step 1: Write failing socket tests**

Append to `tests/unit/socket.test.ts`:

```typescript
import type { Card } from '@/shared/types';

describe('socket: hand:update', () => {
  it('each client receives their own 13-card hand on game start', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;

    const handPromises = clients.map(
      (c) => new Promise<{ hand: Card[] }>((resolve) => c.once('hand:update', resolve))
    );

    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
    }

    await new Promise((resolve) => host.emit('room:start', resolve));

    const hands = await Promise.all(handPromises);
    // Each client got 13 cards
    for (const h of hands) {
      expect(h.hand).toHaveLength(13);
    }
    // All 52 cards across the 4 hands with no duplicates
    const allKeys = new Set(
      hands.flatMap((h) => h.hand.map((c) => `${c.rank}-${c.suit}`))
    );
    expect(allKeys.size).toBe(52);

    clients.forEach((c) => c.disconnect());
  });
});

describe('socket: bid:place + bid:pass', () => {
  it('a valid bid is accepted, broadcast in room:state, and ack returned', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
    }
    await new Promise((resolve) => host.emit('room:start', resolve));

    // wait for everyone to hear "bidding"
    await Promise.all(clients.map(async (c) => {
      await new Promise<void>((resolve) => {
        const handler = (state: any) => {
          if (state.phase === 'bidding') { c.off('room:state', handler); resolve(); }
        };
        c.on('room:state', handler);
      });
    }));

    const broadcastPromise = new Promise<any>((resolve) => host.once('room:state', resolve));
    const ack: any = await new Promise((resolve) => c2.emit('bid:place', { amount: 90 }, resolve));
    expect(ack.ok).toBe(true);

    const state = await broadcastPromise;
    expect(state.game.bid.currentBid).toBe(90);
    expect(state.game.bid.currentBidderSeat).toBe(2);

    clients.forEach((c) => c.disconnect());
  });

  it('rejects an invalid bid amount with INVALID_AMOUNT', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
    }
    await new Promise((resolve) => host.emit('room:start', resolve));

    const ack: any = await new Promise((resolve) => c2.emit('bid:place', { amount: 73 }, resolve));
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('INVALID_AMOUNT');

    clients.forEach((c) => c.disconnect());
  });

  it('completes bidding when 3 non-bidders pass and broadcasts trump_partner phase', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
    }
    await new Promise((resolve) => host.emit('room:start', resolve));
    // wait for bidding state on all
    await Promise.all(clients.map(c => new Promise<void>((resolve) => {
      const h = (s: any) => { if (s.phase === 'bidding') { c.off('room:state', h); resolve(); } };
      c.on('room:state', h);
    })));

    // host (seat 1) bids 90; c2/c3/c4 pass
    await new Promise((resolve) => host.emit('bid:place', { amount: 90 }, resolve));

    // collect final state
    const finalState = new Promise<any>((resolve) => {
      const h = (s: any) => {
        if (s.phase === 'trump_partner') { host.off('room:state', h); resolve(s); }
      };
      host.on('room:state', h);
    });

    for (const c of [c2, c3, c4]) {
      await new Promise((resolve) => c.emit('bid:pass', resolve));
    }

    const state = await finalState;
    expect(state.phase).toBe('trump_partner');
    expect(state.game.bid.complete).toBe(true);
    expect(state.game.bid.currentBid).toBe(90);
    expect(state.game.bid.currentBidderSeat).toBe(1);

    clients.forEach((c) => c.disconnect());
  });
});
```

Run: `npm test` → expect 4 new failures.

- [ ] **Step 2: Update socket.ts to use RoomView projection + add new handlers**

Replace `src/server/socket.ts` with:

```typescript
import type { Server as SocketIOServer, Socket } from 'socket.io';
import { createRoom, joinRoom, getRoom, setConnected, postChat, leaveRoom, startGame, placeBidInRoom, passBidInRoom } from './rooms';
import { toRoomView } from './game/view';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomServerState,
  Seat,
} from '@/shared/types';

type SocketData = { sessionId?: string; roomCode?: string };
type Srv = SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type SrvSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

function roomChannel(code: string): string {
  return `room:${code}`;
}

/** Broadcast public state to everyone in the room. Strips server-only fields. */
function broadcastState(io: Srv, room: RoomServerState): void {
  io.to(roomChannel(room.code)).emit('room:state', toRoomView(room));
}

/** Send each player their private hand. Called when a hand changes (e.g. game start). */
function broadcastHands(io: Srv, room: RoomServerState): void {
  if (!room.hands) return;
  for (const player of room.players) {
    const hand = room.hands[player.seat];
    // Find the sockets in this room channel matching this player's session.
    for (const [, socket] of io.sockets.sockets) {
      if (socket.data.sessionId === player.id) {
        socket.emit('hand:update', { hand });
      }
    }
  }
}

function seatFor(room: RoomServerState, sessionId: string): Seat | null {
  const p = room.players.find((p) => p.id === sessionId);
  return p ? p.seat : null;
}

export function attachSocketHandlers(io: Srv): void {
  io.on('connection', (socket: SrvSocket) => {
    socket.on('room:create', ({ name }, cb) => {
      try {
        const { room, sessionId } = createRoom({ hostName: name });
        socket.data.sessionId = sessionId;
        socket.data.roomCode = room.code;
        socket.join(roomChannel(room.code));
        // Public ack uses the wire-format Room (the existing Room type works as RoomView's
        // structural subset for lobby phase, since game is null). For clean types, project:
        cb({ ok: true, sessionId, room });
      } catch {
        cb({ ok: false, error: 'NAME_INVALID' });
      }
    });

    socket.on('room:join', ({ code, name }, cb) => {
      const res = joinRoom({ code, name });
      if (!res.ok) { cb(res); return; }
      socket.data.sessionId = res.sessionId;
      socket.data.roomCode = code;
      socket.join(roomChannel(code));
      cb(res);
      // res.room is a Room (no hands), so direct broadcast is fine; the full server state
      // is in our rooms map. Use that for the broadcast.
      const server = getRoom(code);
      if (server) broadcastState(io, server);
    });

    socket.on('chat:send', ({ text }) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      const res = postChat({ code: roomCode, sessionId, text });
      if (res.ok) {
        const server = getRoom(roomCode);
        if (server) broadcastState(io, server);
      }
    });

    socket.on('room:leave', () => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      const res = leaveRoom({ code: roomCode, sessionId });
      socket.leave(roomChannel(roomCode));
      socket.data.sessionId = undefined;
      socket.data.roomCode = undefined;
      if (res.ok && !res.wasLastPlayer && res.room) {
        const server = getRoom(roomCode);
        if (server) broadcastState(io, server);
      }
    });

    socket.on('room:start', (cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_HOST' }); return; }
      const res = startGame({ code: roomCode, sessionId });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      broadcastHands(io, res.room);
      broadcastState(io, res.room);
    });

    socket.on('bid:place', ({ amount }, cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const room = getRoom(roomCode);
      if (!room) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const seat = seatFor(room, sessionId);
      if (seat === null) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }

      const res = placeBidInRoom({ code: roomCode, seat, amount });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      broadcastState(io, res.room);
    });

    socket.on('bid:pass', (cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const room = getRoom(roomCode);
      if (!room) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const seat = seatFor(room, sessionId);
      if (seat === null) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }

      const res = passBidInRoom({ code: roomCode, seat });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      broadcastState(io, res.room);
    });

    socket.on('disconnect', () => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      setConnected({ code: roomCode, sessionId, connected: false });
      const room = getRoom(roomCode);
      if (room) broadcastState(io, room);
    });
  });
}
```

You'll also need `placeBidInRoom` and `passBidInRoom` in `rooms.ts` — Task 7 adds them.

Hold off running the socket tests until Task 7 is done.

- [ ] **Step 3: Commit (partial — code may not compile until Task 7)**

Wait. Don't commit yet — Task 6 and Task 7 are paired. Apply both before testing/committing. Note this as a single working chunk.

Actually, to keep commits clean, we'll **squash Tasks 6 and 7 into one commit** at the end of Task 7. Continue without committing.

---

## Task 7: Room manager bidding actions

**Files:**
- Modify: `src/server/rooms.ts`

- [ ] **Step 1: Add `placeBidInRoom` and `passBidInRoom` to rooms.ts**

Append to `src/server/rooms.ts`:

```typescript
import { placeBid, passBid } from './game/bidding';
import type { Seat, BidActionResult } from '@/shared/types';

export interface BidInRoomInput {
  code: string;
  seat: Seat;
  amount?: number; // only for placeBid
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
  if (!res.ok) return { ok: false, error: res.error as any };
  room.game.bid = res.state;
  return { ok: true, room };
}

export function passBidInRoom(input: { code: string; seat: Seat }): BidInRoomResult {
  const room = rooms.get(input.code);
  if (!room || !room.game || room.phase !== 'bidding') {
    return { ok: false, error: 'NOT_IN_GAME' };
  }
  const res = passBid(room.game.bid, input.seat);
  if (!res.ok) return { ok: false, error: res.error as any };
  room.game.bid = res.state;
  // Auto-advance phase when bidding completes.
  if (res.justCompleted) {
    room.phase = 'trump_partner';
  }
  return { ok: true, room };
}
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: all tests pass — both the room-manager tests (60 from Task 5) AND the new socket tests from Task 6 (+4 = 64 total).

If a socket test times out, check that `broadcastHands` finds the matching socket via `socket.data.sessionId`. The lookup iterates `io.sockets.sockets`; that's fine.

- [ ] **Step 3: Verify TS + lint clean**

Run: `npx tsc --noEmit && npm run lint`
Expected: both 0.

- [ ] **Step 4: Commit (Tasks 6 + 7 together)**

```bash
git add src/server/socket.ts src/server/rooms.ts tests/unit/socket.test.ts
git commit -m "Wire bid:place, bid:pass socket events with hand:update broadcast"
```

---

## Task 8: Client store — hand state

**Files:**
- Modify: `src/client/store.ts`
- Modify: `src/client/useSocket.ts`

- [ ] **Step 1: Extend store with hand state**

Replace `src/client/store.ts`:

```typescript
'use client';
import { create } from 'zustand';
import type { RoomView, Player, Card } from '@/shared/types';

export interface GameStore {
  sessionId: string | null;
  room: RoomView | null;
  yourHand: Card[];
  connected: boolean;

  setSession(sessionId: string): void;
  setRoom(room: RoomView | null): void;
  setHand(hand: Card[]): void;
  setConnected(c: boolean): void;
  reset(): void;
}

export const useGameStore = create<GameStore>((set) => ({
  sessionId: null,
  room: null,
  yourHand: [],
  connected: false,
  setSession: (sessionId) => set({ sessionId }),
  setRoom: (room) => set({ room }),
  setHand: (yourHand) => set({ yourHand }),
  setConnected: (connected) => set({ connected }),
  reset: () => set({ sessionId: null, room: null, yourHand: [] }),
}));

export function selectMe(state: GameStore): Player | null {
  if (!state.room || !state.sessionId) return null;
  return state.room.players.find((p) => p.id === state.sessionId) ?? null;
}
```

Note: the `room` field is now `RoomView` (was `Room`). This is a type widening — `RoomView` extends `Room` with an optional `game` field, so existing code that only reads lobby fields keeps working.

- [ ] **Step 2: Wire hand:update in useSocket**

Replace `src/client/useSocket.ts`:

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, Card, RoomView } from '@/shared/types';
import { useGameStore } from './store';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let singletonSocket: ClientSocket | null = null;

export function useSocket(): ClientSocket {
  const ref = useRef<ClientSocket | null>(singletonSocket);
  const setConnected = useGameStore((s) => s.setConnected);
  const setRoom = useGameStore((s) => s.setRoom);
  const setHand = useGameStore((s) => s.setHand);

  if (!ref.current) {
    singletonSocket = io({ transports: ['websocket'] });
    ref.current = singletonSocket;
  }

  useEffect(() => {
    const socket = ref.current!;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onRoomState = (room: RoomView) => setRoom(room);
    const onHandUpdate = (payload: { hand: Card[] }) => setHand(payload.hand);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('hand:update', onHandUpdate);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('hand:update', onHandUpdate);
    };
  }, [setConnected, setRoom, setHand]);

  return ref.current!;
}
```

- [ ] **Step 3: Verify TS + lint clean**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0.

- [ ] **Step 4: Commit**

```bash
git add src/client/
git commit -m "Add yourHand to store; subscribe to hand:update in useSocket"
```

---

## Task 9: BidPanel + StatusPill components

**Files:**
- Create: `src/components/bidding/BidPanel.tsx`
- Create: `src/components/bidding/StatusPill.tsx`

- [ ] **Step 1: Create StatusPill**

Create `src/components/bidding/StatusPill.tsx`:

```tsx
type Variant = 'live' | 'bid' | 'passed' | 'bidder';

interface StatusPillProps {
  variant: Variant;
  label: string;
  pulse?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  live:    'bg-blue-400/20 text-blue-300 border border-blue-400/40',
  bid:     'bg-gold-500 text-black font-bold',
  passed:  'bg-white/5 text-neutral-400 border border-white/10',
  bidder:  'bg-gold-500/20 text-gold-500 border border-gold-500/40 font-semibold',
};

export function StatusPill({ variant, label, pulse }: StatusPillProps) {
  return (
    <span
      className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${VARIANT_CLASSES[variant]} ${pulse ? 'animate-pulse' : ''}`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create BidPanel**

Create `src/components/bidding/BidPanel.tsx`:

```tsx
'use client';
import type { BidState, Seat } from '@/shared/types';
import { MIN_BID, MAX_BID, BID_INCREMENT } from '@/shared/types';

interface BidPanelProps {
  bid: BidState;
  yourSeat: Seat;
  /** Disabled until the user resolves a pending action. */
  busy?: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

export function BidPanel({ bid, yourSeat, busy, onBid, onPass }: BidPanelProps) {
  const isCurrentBidder = bid.currentBidderSeat === yourSeat;
  const youPassed = bid.passedSeats.includes(yourSeat) && !isCurrentBidder;

  const nextMin = bid.currentBid === null ? MIN_BID : bid.currentBid + BID_INCREMENT;
  const visibleAmounts: number[] = [];
  for (let a = nextMin; a <= MAX_BID && visibleAmounts.length < 8; a += BID_INCREMENT) {
    visibleAmounts.push(a);
  }

  return (
    <div className="w-[360px] mx-auto bg-felt-900/95 border border-gold-500/40 rounded-2xl p-5 shadow-2xl">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] uppercase tracking-widest text-gold-500 font-bold">● Bidding</span>
        <span className="text-[10px] text-neutral-500">no timer · waits for passes</span>
      </div>

      <div className="text-center py-3">
        {bid.currentBid === null ? (
          <>
            <div className="text-4xl font-bold text-gold-500 leading-none">—</div>
            <div className="text-xs text-neutral-400 mt-1">no bid yet · floor {MIN_BID}</div>
          </>
        ) : (
          <>
            <div className="text-5xl font-bold text-gold-500 leading-none">{bid.currentBid}</div>
            <div className="text-xs text-neutral-300 mt-1">
              held by <b className={isCurrentBidder ? 'text-gold-500' : 'text-white'}>seat {bid.currentBidderSeat}</b>
            </div>
          </>
        )}
      </div>

      <div className={`grid grid-cols-4 gap-2 mb-3 ${youPassed ? 'opacity-30 pointer-events-none' : ''}`}>
        {visibleAmounts.map((amt) => {
          const delta = bid.currentBid === null ? null : amt - bid.currentBid;
          return (
            <button
              key={amt}
              type="button"
              disabled={busy}
              onClick={() => onBid(amt)}
              className="bg-gradient-to-b from-felt-700 to-felt-800 hover:from-felt-800 hover:to-felt-900 hover:border-gold-500 border border-gold-500/25 text-white text-sm font-bold rounded-lg py-2 disabled:opacity-50"
            >
              {delta !== null && <span className="block text-[9px] text-gold-500 font-medium">+{delta}</span>}
              {amt}
            </button>
          );
        })}
      </div>

      {bid.currentBid !== null && !isCurrentBidder && (
        <button
          type="button"
          disabled={busy || youPassed}
          onClick={onPass}
          className="w-full bg-white/5 hover:bg-red-400/15 hover:border-red-400 border border-white/15 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
        >
          {youPassed ? 'Passed' : `Pass at ${bid.currentBid}`}
        </button>
      )}

      {youPassed && (
        <div className="text-center text-[11px] text-gold-500 mt-2">You passed. Waiting for others.</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TS + lint clean**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/bidding/
git commit -m "Add BidPanel and StatusPill components"
```

---

## Task 10: HandPreview component

**Files:**
- Create: `src/components/bidding/HandPreview.tsx`

- [ ] **Step 1: Create HandPreview**

Create `src/components/bidding/HandPreview.tsx`:

```tsx
import { Card } from '@/components/Card';
import type { Card as CardType } from '@/shared/types';

interface HandPreviewProps {
  hand: CardType[];
}

/** Order: hearts, diamonds, clubs, spades; within each suit ascending rank. */
const SUIT_ORDER = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

function sortHand(hand: CardType[]): CardType[] {
  return [...hand].sort((a, b) => {
    const s = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (s !== 0) return s;
    return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  });
}

export function HandPreview({ hand }: HandPreviewProps) {
  const sorted = sortHand(hand);
  return (
    <div className="flex justify-center items-end gap-[-12px]" style={{ marginLeft: 0 }}>
      {sorted.map((card, i) => (
        <div
          key={i}
          className="transition-transform hover:-translate-y-2"
          style={{ marginLeft: i === 0 ? 0 : '-22px' }}
        >
          <Card card={card} size="sm" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TS + lint clean**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/bidding/HandPreview.tsx
git commit -m "Add HandPreview component for bidding phase"
```

---

## Task 11: Wire bidding phase into /room/[code]

**Files:**
- Modify: `src/app/room/[code]/page.tsx`
- Delete: `src/app/game-starting/` (entire directory)

- [ ] **Step 1: Replace the waiting-room page with the phase-aware version**

Replace `src/app/room/[code]/page.tsx` entirely with:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { selectMe, useGameStore } from '@/client/store';
import { Seat } from '@/components/Seat';
import { InviteCard } from '@/components/InviteCard';
import { StartCard } from '@/components/StartCard';
import { ChatPanel } from '@/components/ChatPanel';
import { BidPanel } from '@/components/bidding/BidPanel';
import { StatusPill } from '@/components/bidding/StatusPill';
import { HandPreview } from '@/components/bidding/HandPreview';
import type { JoinRoomResult, Player, StartGameResult, BidActionAck, Seat as SeatT } from '@/shared/types';

function rotateSeats(viewerSeat: SeatT) {
  return {
    bottom: viewerSeat,
    left: (viewerSeat % 4) + 1,
    top: ((viewerSeat + 1) % 4) + 1,
    right: ((viewerSeat + 2) % 4) + 1,
  };
}

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const router = useRouter();
  const socket = useSocket();

  const room = useGameStore((s) => s.room);
  const sessionId = useGameStore((s) => s.sessionId);
  const yourHand = useGameStore((s) => s.yourHand);
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const me = useGameStore(selectMe);

  const [joinName, setJoinName] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [bidBusy, setBidBusy] = useState(false);

  // No phase-based redirects needed — this page handles all phases.

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinErr(null);
    if (!joinName.trim()) { setJoinErr('Pick a display name'); return; }
    setJoinBusy(true);
    const res = await new Promise<JoinRoomResult>((resolve) =>
      socket.emit('room:join', { code, name: joinName.trim() }, resolve)
    );
    setJoinBusy(false);
    if (!res.ok) {
      setJoinErr(
        res.error === 'NOT_FOUND' ? 'Room not found.'
        : res.error === 'FULL' ? 'Room is full.'
        : res.error === 'NAME_TAKEN' ? 'Name is taken.'
        : 'Invalid name.'
      );
      return;
    }
    setSession(res.sessionId);
    setRoom(res.room);
  }

  if (!sessionId || !me) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">
        <div className="text-center">
          <div className="text-gold-500 text-5xl font-serif leading-none">♛</div>
          <div className="text-xl font-bold mt-1">Black Queen</div>
        </div>
        <div className="w-80 bg-black/40 border border-white/10 rounded-xl p-5">
          <div className="text-center text-xs text-neutral-400">You&apos;ve been invited to room</div>
          <div className="text-center text-lg font-mono font-bold text-gold-500 mt-1">{code}</div>
          <form onSubmit={handleJoin} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">Your display name</label>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={20}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500"
                placeholder="Pick something fun"
              />
            </div>
            <button
              type="submit"
              disabled={joinBusy}
              className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-black font-bold rounded-lg py-2.5 text-sm"
            >
              Join room
            </button>
            {joinErr && <div className="text-red-400 text-xs text-center">{joinErr}</div>}
          </form>
        </div>
      </main>
    );
  }

  if (!room) {
    return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;
  }

  const seatLayout = rotateSeats(me.seat);
  const playerAt = (seat: number): Player | null =>
    room.players.find((p) => p.seat === seat) ?? null;

  function handleStart() {
    socket.emit('room:start', (res: StartGameResult) => {
      if (!res.ok) console.warn('Start failed:', res.error);
    });
  }
  function handleSendChat(text: string) {
    socket.emit('chat:send', { text });
  }

  function handleBid(amount: number) {
    setBidBusy(true);
    socket.emit('bid:place', { amount }, (res: BidActionAck) => {
      setBidBusy(false);
      if (!res.ok) console.warn('Bid failed:', res.error);
    });
  }
  function handlePass() {
    setBidBusy(true);
    socket.emit('bid:pass', (res: BidActionAck) => {
      setBidBusy(false);
      if (!res.ok) console.warn('Pass failed:', res.error);
    });
  }

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${room.code}` : `/room/${room.code}`;
  const isHost = room.hostId === sessionId;
  const isFull = room.players.length >= 4;

  // ============ LOBBY (Plan 1 layout) ============
  if (room.phase === 'lobby') {
    return (
      <main className="min-h-screen p-6">
        <div className="flex items-center justify-between mb-4 max-w-3xl mx-auto">
          <div>
            <div className="text-[9px] uppercase tracking-widest text-neutral-400">Room</div>
            <div className="text-xl font-bold text-gold-500 font-mono tracking-widest">{room.code}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest text-neutral-400">Players</div>
            <div className="text-sm font-semibold text-gold-500">{room.players.length} / 4</div>
          </div>
        </div>

        <div className="relative mx-auto max-w-3xl h-72">
          <div className="absolute top-0 left-1/2 -translate-x-1/2"><Seat player={playerAt(seatLayout.top)} seatLabel={`seat ${seatLayout.top}`} isHost={!!playerAt(seatLayout.top) && playerAt(seatLayout.top)!.id === room.hostId} /></div>
          <div className="absolute top-1/2 left-8 -translate-y-1/2"><Seat player={playerAt(seatLayout.left)} seatLabel={`seat ${seatLayout.left}`} isHost={!!playerAt(seatLayout.left) && playerAt(seatLayout.left)!.id === room.hostId} /></div>
          <div className="absolute top-1/2 right-8 -translate-y-1/2"><Seat player={playerAt(seatLayout.right)} seatLabel={`seat ${seatLayout.right}`} isHost={!!playerAt(seatLayout.right) && playerAt(seatLayout.right)!.id === room.hostId} /></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2"><Seat player={me} seatLabel={`seat ${seatLayout.bottom}`} isYou isHost={isHost} /></div>
        </div>

        <div className="flex justify-center gap-4 mt-4">
          <InviteCard code={room.code} url={inviteUrl} disabled={isFull} />
          <StartCard filled={room.players.length} isHost={isHost} onStart={handleStart} />
        </div>

        <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={handleSendChat} /></div>
      </main>
    );
  }

  // ============ BIDDING ============
  if (room.phase === 'bidding') {
    const bid = room.game!.bid;
    const seatStatus = (seat: number) => {
      if (bid.currentBidderSeat === seat) return { variant: 'bidder' as const, label: `bid ${bid.currentBid}` };
      if (bid.passedSeats.includes(seat as SeatT)) return { variant: 'passed' as const, label: 'passed' };
      return { variant: 'live' as const, label: 'deciding…', pulse: true };
    };

    return (
      <main className="min-h-screen p-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-4">
            <div className="text-[10px] uppercase tracking-widest text-gold-500 font-bold">Bidding phase</div>
            <div className="text-xs text-neutral-400 mt-1">Min {75} · Max {150} · Increments of 5</div>
          </div>

          <div className="relative h-56 mb-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
              <div className="text-sm font-semibold">{playerAt(seatLayout.top)?.name}</div>
              <StatusPill {...seatStatus(seatLayout.top)} />
            </div>
            <div className="absolute top-1/2 left-8 -translate-y-1/2 text-center">
              <div className="text-sm font-semibold">{playerAt(seatLayout.left)?.name}</div>
              <StatusPill {...seatStatus(seatLayout.left)} />
            </div>
            <div className="absolute top-1/2 right-8 -translate-y-1/2 text-center">
              <div className="text-sm font-semibold">{playerAt(seatLayout.right)?.name}</div>
              <StatusPill {...seatStatus(seatLayout.right)} />
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
              <BidPanel bid={bid} yourSeat={me.seat} busy={bidBusy} onBid={handleBid} onPass={handlePass} />
            </div>
          </div>

          <div className="mt-8">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 text-center mb-2">your hand</div>
            <HandPreview hand={yourHand} />
            <div className="text-center mt-3">
              <span className="text-sm font-semibold">{me.name}</span>
              <span className="ml-2"><StatusPill {...seatStatus(me.seat)} /></span>
            </div>
          </div>
        </div>

        <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={handleSendChat} /></div>
      </main>
    );
  }

  // ============ trump_partner / play / end — placeholder until Plan 3 ============
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <div className="text-gold-500 text-5xl font-serif">♛</div>
      <div className="text-2xl font-bold">Phase: <span className="text-gold-500">{room.phase}</span></div>
      <div className="text-xs text-neutral-500 mt-2">(Plan 3 builds this UI.)</div>
    </main>
  );
}
```

- [ ] **Step 2: Delete the obsolete /game-starting placeholder**

```bash
rm -r src/app/game-starting
```

- [ ] **Step 3: Verify TS + lint clean + dev server boots**

Run: `npx tsc --noEmit && npm run lint`
Expected: both 0.

Boot the dev server briefly with the background trick:

```bash
npm run dev > /tmp/dev-test.log 2>&1 &
SERVER_PID=$!
for i in {1..30}; do
  if grep -q "Ready on http" /tmp/dev-test.log 2>/dev/null; then break; fi
  sleep 1
done
curl -s http://localhost:3000 | head -c 200
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

Confirm "Black Queen" appears in the response and there are no server errors in the log.

- [ ] **Step 4: Update existing E2E test for the new route**

The Plan 1 E2E test (`tests/e2e/lobby.spec.ts`) asserts `await expect(page).toHaveURL(/\/game-starting/);` after Start. That URL no longer exists. Edit `tests/e2e/lobby.spec.ts`:

Replace:

```typescript
  // All 4 pages should transition to /game-starting.
  for (const page of pages) {
    await expect(page).toHaveURL(/\/game-starting/);
    await expect(page.getByText(/Phase:/)).toBeVisible();
  }
```

with:

```typescript
  // After Start, all 4 pages should show the Bidding phase header (still on /room/CODE).
  for (const page of pages) {
    await expect(page.getByText(/Bidding phase/i)).toBeVisible();
  }
```

- [ ] **Step 5: Run E2E**

Run: `npm run test:e2e`
Expected: 3 tests pass (the lobby flow now ends at the bidding screen instead of /game-starting).

- [ ] **Step 6: Commit**

```bash
git add src/app/room/ tests/e2e/lobby.spec.ts
git rm -r src/app/game-starting
git commit -m "Render bidding UI in /room/[code]; delete /game-starting placeholder"
```

---

## Task 12: Playwright E2E for bidding flow

**Files:**
- Create: `tests/e2e/bidding.spec.ts`

- [ ] **Step 1: Write the bidding E2E**

Create `tests/e2e/bidding.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

async function fourPlayerRoomReady(browser: any) {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((c: any) => c.newPage()));
  const [host, g1, g2, g3] = pages;

  await host.goto('/');
  await host.getByPlaceholder('e.g. Dev').fill('Dev');
  await host.getByRole('button', { name: /Create a new room/i }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z]{4}/);
  const roomUrl = host.url();

  for (const [page, name] of [
    [g1, 'Sam'],
    [g2, 'Riya'],
    [g3, 'Aman'],
  ] as const) {
    await page.goto(roomUrl);
    await page.getByPlaceholder('Pick something fun').fill(name);
    await page.getByRole('button', { name: /Join room/i }).click();
  }

  await host.getByRole('button', { name: /^Start Game$/ }).click();
  // Wait for bidding phase to render
  for (const page of pages) {
    await expect(page.getByText(/Bidding phase/i)).toBeVisible();
  }
  return { contexts, pages, host, g1, g2, g3, roomUrl };
}

test('after start, every player sees 13 cards in their hand', async ({ browser }) => {
  const { contexts, pages } = await fourPlayerRoomReady(browser);

  for (const page of pages) {
    // Hand previews use the Card visual with a rank in the corner. We expect 13 cards.
    // The Card component renders the rank as text — count the rank glyphs in the hand area.
    // Alternative: ensure the hand container has 13 children.
    const cardCount = await page.locator('main >> text=/^(A|K|Q|J|10|9|8|7|6|5|4|3|2)$/').count();
    // Rank text appears twice per card (top-left + rotated bottom-right) plus the suit glyph;
    // we just confirm at least 13 distinct ranks in the DOM.
    expect(cardCount).toBeGreaterThanOrEqual(13);
  }

  await Promise.all(contexts.map((c: any) => c.close()));
});

test('host places a bid, all 4 clients see the new current bid', async ({ browser }) => {
  const { contexts, pages, host } = await fourPlayerRoomReady(browser);

  // Host clicks the bid button for 75 (the leftmost quick-bid in the grid).
  await host.getByRole('button', { name: '75' }).click();

  // All clients should see the bid value reflected.
  for (const page of pages) {
    await expect(page.getByText('75').first()).toBeVisible();
  }

  await Promise.all(contexts.map((c: any) => c.close()));
});

test('after 3 non-bidders pass, phase becomes trump_partner', async ({ browser }) => {
  const { contexts, pages, host, g1, g2, g3 } = await fourPlayerRoomReady(browser);

  await host.getByRole('button', { name: '75' }).click();

  // The 3 non-bidders each click "Pass at 75" (or "Pass"). After all three, the
  // server transitions phase to trump_partner.
  for (const page of [g1, g2, g3]) {
    await page.getByRole('button', { name: /Pass at 75|^Pass$/ }).click();
  }

  for (const page of pages) {
    await expect(page.getByText(/Phase:.*trump_partner/i)).toBeVisible();
  }

  await Promise.all(contexts.map((c: any) => c.close()));
});
```

Run: `npm run test:e2e`
Expected: 6 tests total pass (3 from Plan 1 lobby + 3 new bidding tests).

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/bidding.spec.ts
git commit -m "Add Playwright E2E for bidding flow"
```

---

## Task 13: Final smoke + plan-level commit

**Files:**
- None (verification only)

- [ ] **Step 1: Full smoke**

Run:

```bash
npm run lint && npm test && npm run test:e2e
```

Expected:
- Lint clean.
- Unit tests: all pass (Plan 1's 37 + Plan 2's ~28 = ~65 tests).
- E2E tests: 6 pass (3 lobby + 3 bidding).

- [ ] **Step 2: If everything passes, you're done. No commit needed.**

If anything fails, fix and commit a follow-up labeled `Plan 2 follow-up: <what>`.

---

## Done criteria for Plan 2

- [ ] `npm run dev` boots; visiting `http://localhost:3000` and creating a 4-player room + clicking Start results in:
  - The phase transitioning to `bidding` for all 4 clients.
  - Each client receiving their own 13-card hand (visible at the bottom).
  - The center showing the BidPanel with quick-bid buttons starting at 75.
  - Each seat showing a StatusPill: "deciding…", "bid X", "passed".
- [ ] Placing a bid updates the current bid display for all 4 clients within ~100 ms.
- [ ] Passing increments the passedSeats list; once 3 non-bidders pass, phase auto-advances to `trump_partner` (placeholder screen).
- [ ] Invalid bids (below 75, above 150, not a multiple of 5, not higher than current) are rejected with a console warning.
- [ ] Bidder can self-raise.
- [ ] All `npm test` unit tests pass.
- [ ] All `npm run test:e2e` Playwright tests pass.
- [ ] `npx tsc --noEmit` clean; `npm run lint` clean.

---

## Open questions / carried forward

- **Race condition on simultaneous bids.** Two clients clicking "75" at the same instant: server processes them serially; the second one fails with `NOT_HIGHER` (correct semantics). The client should display this transient error gracefully rather than just console.warn — polish for a later plan.
- **No "you are the bidder" highlight beyond the StatusPill.** Plan 3 / polish.
- **No bid history.** Per spec, only the current high bid matters. If chat reveals this naturally (it doesn't yet), fine.
- **Animation on bid placement and phase transition** — deferred to a polish plan.
- **`broadcastHands` iterates `io.sockets.sockets`** which is O(N) for connected sockets. Fine for a hobby app; switch to a `sessionId → socketId` index in Plan 5 alongside reconnect handling.
