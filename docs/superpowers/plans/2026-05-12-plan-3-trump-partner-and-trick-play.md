# Black Queen — Plan 3: Trump/Partner Selection + Trick Play

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Bidder picks trump suit + partner card; everyone else sees a waiting screen; the picker confirms and game advances to the **play** phase. 13 tricks are played with full rule enforcement (must follow led suit; trump beats non-trump; highest trump wins; highest of led suit wins if no trump). The called partner card's owner is silently their partner; revealing happens when that card is played. After 13 tricks, phase advances to **end** (placeholder until Plan 4).

**Architecture:** Two new pure-logic modules: `src/server/game/trump-partner.ts` (validates the bidder's choice) and `src/server/game/trick.ts` (trick state machine + legal-move validation + trick resolution). `Room.game` widens to carry `trump`, `calledCard`, `partnerSeat` (server-internal), and `tricks` (current + completed). The wire format keeps hands hidden per-player as in Plan 2. The page.tsx mega-component is refactored into a `JoinView/WaitingRoomView/BiddingView/TrumpPartnerView/TrickPlayView` router so each phase has its own focused file.

**Tech Stack:** Unchanged.

**Out of scope (Plans 4-5):** end-of-game results screen, scoring reveal, disconnect/reconnect with full hand recovery.

---

## File map

```
src/
├── shared/
│   └── types.ts                            # MODIFY: TrumpPartnerChoice, TrickState, GameState extensions, card:play/trump:choose events
├── server/
│   ├── rooms.ts                            # MODIFY: chooseTrumpPartnerInRoom, playCardInRoom, advancement helpers
│   ├── socket.ts                           # MODIFY: trump:choose, card:play handlers
│   └── game/
│       ├── trump-partner.ts                # NEW: validate + apply bidder's choice
│       └── trick.ts                        # NEW: place card, resolve trick, find winner
├── client/
│   └── store.ts                            # unchanged (RoomView already carries game)
├── components/
│   ├── views/                              # NEW directory — refactor out of page.tsx
│   │   ├── JoinView.tsx
│   │   ├── WaitingRoomView.tsx
│   │   ├── BiddingView.tsx
│   │   ├── TrumpPartnerView.tsx
│   │   └── TrickPlayView.tsx
│   ├── trump-partner/                      # NEW
│   │   ├── TrumpPartnerModal.tsx           # bidder's picker (4-suit grid + 4×13 card grid)
│   │   └── WaitingForChoice.tsx            # non-bidder spinner
│   ├── play/                               # NEW
│   │   ├── CardBack.tsx                    # opponent face-down card visual
│   │   ├── OpponentFan.tsx                 # fanned backs, orientation per seat
│   │   ├── PlayedCardsCenter.tsx           # cross-layout of the in-progress trick
│   │   ├── PlayerHand.tsx                  # arced, hover-lift, click-to-stage hand
│   │   └── InfoBadges.tsx                  # top-left trump/bid/called badges
│   └── shared/
│       └── seatNameFor.ts                  # NEW small helper used across views
├── app/
│   └── room/[code]/page.tsx                # SLIM to a phase router
└── tests/
    ├── unit/
    │   ├── trump-partner.test.ts           # NEW
    │   ├── trick.test.ts                   # NEW
    │   └── (rooms, socket): extended
    └── e2e/
        └── play.spec.ts                    # NEW
```

---

## Task 1: Shared types — trump/partner + trick + game extensions

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add the new types**

Append to `src/shared/types.ts` (after the Bidding section, before the existing Game State block):

```typescript
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
```

- [ ] **Step 2: Extend `GameState` and `RoomServerState`**

Replace the existing `GameState` (currently `{ bid: BidState }`) with:

```typescript
export interface GameState {
  bid: BidState;
  /** Trump suit + called partner card. Set when trump_partner phase completes. */
  trumpPartner: TrumpPartnerChoice | null;
  /** Current trick being built. Set when phase advances to 'play'. */
  currentTrick: CurrentTrick | null;
  /** Completed tricks in order (most recent last). Max 13. */
  completedTricks: CompletedTrick[];
  /**
   * Server-known partner seat (the player holding `calledCard`). Revealed
   * publicly when that card is played; until then, only the server (and
   * silently the holder, who sees the card in their own hand) knows.
   *
   * Wire visibility: `revealedPartnerSeat` (below) is the public projection.
   */
  partnerSeat: Seat | null;
  /** Public — set when the called card has been played. */
  revealedPartnerSeat: Seat | null;
}
```

Update `RoomServerState` if anything else needs to change (it inherits the new GameState through `RoomView extends Room`, so `hands` is still the only server-only field).

**Important:** the server keeps `partnerSeat` internally, but `toRoomView` must STRIP it from the broadcast. Update `view.ts` accordingly (Task 4).

- [ ] **Step 3: Extend the wire event types**

Add to `ClientToServerEvents`:

```typescript
  'trump:choose': (
    payload: { trump: Suit; calledCard: Card },
    cb: (res: TrumpPartnerActionAck) => void
  ) => void;
  'card:play': (
    payload: { card: Card },
    cb: (res: PlayCardAck) => void
  ) => void;
```

And add the wire ack types near the other ack types:

```typescript
export type TrumpPartnerActionAck =
  | { ok: true }
  | { ok: false; error: 'NOT_BIDDER' | 'INVALID_CARD' | 'OWN_CARD' | 'NOT_IN_GAME' | 'NOT_IN_ROOM' };

export type PlayCardAck =
  | { ok: true }
  | { ok: false; error: 'NOT_YOUR_TURN' | 'NOT_IN_HAND' | 'MUST_FOLLOW_SUIT' | 'NOT_IN_GAME' | 'NOT_IN_ROOM' };
```

- [ ] **Step 4: Verify TS + lint clean; commit**

```bash
npx tsc --noEmit && npm run lint
git add src/shared/types.ts
git commit -m "Add trump/partner + trick types; extend GameState and wire events"
```

(No `Co-Authored-By`.)

---

## Task 2: Trump-Partner state machine

**Files:**
- Create: `src/server/game/trump-partner.ts`
- Create: `tests/unit/trump-partner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/trump-partner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateTrumpPartnerChoice } from '@/server/game/trump-partner';
import type { Card } from '@/shared/types';

const aceHearts: Card = { suit: 'hearts', rank: 'A' };
const fiveClubs: Card = { suit: 'clubs', rank: '5' };

const sampleHands = {
  1: [{ suit: 'spades' as const, rank: 'K' as const }, { suit: 'hearts' as const, rank: '2' as const }],
  2: [aceHearts],
  3: [fiveClubs],
  4: [{ suit: 'diamonds' as const, rank: '9' as const }],
};

describe('validateTrumpPartnerChoice', () => {
  it('accepts a card the bidder does not hold', () => {
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1,
      hands: sampleHands,
      trump: 'spades',
      calledCard: aceHearts, // held by seat 2, not by bidder (1)
    });
    expect(res.ok).toBe(true);
  });

  it('rejects calling a card the bidder holds (OWN_CARD)', () => {
    const ownCard: Card = { suit: 'hearts', rank: '2' }; // in seat 1's hand
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1,
      hands: sampleHands,
      trump: 'spades',
      calledCard: ownCard,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('OWN_CARD');
  });

  it('rejects an invalid card (rank/suit outside the deck)', () => {
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1,
      hands: sampleHands,
      trump: 'spades',
      calledCard: { suit: 'hearts', rank: '1' as any },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_CARD');
  });

  it('finds the partner seat that holds the called card', () => {
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1,
      hands: sampleHands,
      trump: 'spades',
      calledCard: fiveClubs, // held by seat 3
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.partnerSeat).toBe(3);
  });

  it('rejects if no seat holds the called card (should never happen — defensive)', () => {
    const phantomCard: Card = { suit: 'hearts', rank: '7' };
    const res = validateTrumpPartnerChoice({
      bidderSeat: 1,
      hands: sampleHands,
      trump: 'spades',
      calledCard: phantomCard,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('INVALID_CARD');
  });
});
```

Run `npm test` — expect failures.

- [ ] **Step 2: Implement**

Create `src/server/game/trump-partner.ts`:

```typescript
import {
  type Card,
  type Suit,
  type Seat,
  RANKS,
  SUITS,
  cardKey,
} from '@/shared/types';

export interface ValidateInput {
  bidderSeat: Seat;
  hands: Record<Seat, Card[]>;
  trump: Suit;
  calledCard: Card;
}

export type ValidateOutput =
  | { ok: true; partnerSeat: Seat }
  | { ok: false; error: 'INVALID_CARD' | 'OWN_CARD' };

function isLegalCard(card: Card): boolean {
  return SUITS.includes(card.suit) && RANKS.includes(card.rank);
}

export function validateTrumpPartnerChoice(input: ValidateInput): ValidateOutput {
  if (!isLegalCard(input.calledCard)) return { ok: false, error: 'INVALID_CARD' };

  // Find which seat holds the called card.
  const key = cardKey(input.calledCard);
  let owner: Seat | null = null;
  for (const seat of [1, 2, 3, 4] as Seat[]) {
    if (input.hands[seat].some((c) => cardKey(c) === key)) {
      owner = seat;
      break;
    }
  }
  if (owner === null) return { ok: false, error: 'INVALID_CARD' };
  if (owner === input.bidderSeat) return { ok: false, error: 'OWN_CARD' };

  return { ok: true, partnerSeat: owner };
}
```

Run `npm test` → all pass.

- [ ] **Step 3: Commit**

```bash
git add src/server/game/trump-partner.ts tests/unit/trump-partner.test.ts
git commit -m "Add trump-partner validation: find owner, reject own/invalid"
```

---

## Task 3: Trick state machine

**Files:**
- Create: `src/server/game/trick.ts`
- Create: `tests/unit/trick.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/trick.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  startTrick,
  playCardInTrick,
  resolveTrick,
  isLegalPlay,
} from '@/server/game/trick';
import type { Card, CurrentTrick, Suit } from '@/shared/types';

const c = (suit: Suit, rank: any): Card => ({ suit, rank });

describe('startTrick', () => {
  it('returns a fresh trick led by the given seat with empty plays', () => {
    const t = startTrick(2);
    expect(t.ledBy).toBe(2);
    expect(t.ledSuit).toBeNull();
    expect(t.plays).toEqual([]);
  });
});

describe('isLegalPlay', () => {
  it('any card is legal as the first play (no led suit yet)', () => {
    const t = startTrick(1);
    expect(isLegalPlay(t, [c('hearts', '5'), c('spades', 'A')], c('spades', 'A'))).toBe(true);
  });

  it('must follow led suit if the player has it', () => {
    const t = { ledBy: 1, ledSuit: 'hearts' as Suit, plays: [{ seat: 1, card: c('hearts', 'K') }] };
    const hand = [c('hearts', '2'), c('spades', 'A')];
    expect(isLegalPlay(t, hand, c('spades', 'A'))).toBe(false);
    expect(isLegalPlay(t, hand, c('hearts', '2'))).toBe(true);
  });

  it('can play any card when void in led suit', () => {
    const t = { ledBy: 1, ledSuit: 'hearts' as Suit, plays: [{ seat: 1, card: c('hearts', 'K') }] };
    const hand = [c('spades', 'A'), c('clubs', '2')];
    expect(isLegalPlay(t, hand, c('spades', 'A'))).toBe(true);
    expect(isLegalPlay(t, hand, c('clubs', '2'))).toBe(true);
  });
});

describe('playCardInTrick', () => {
  it('sets ledSuit on first play', () => {
    const t = startTrick(2);
    const r = playCardInTrick(t, 2, c('hearts', '7'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trick.ledSuit).toBe('hearts');
    expect(r.trick.plays).toHaveLength(1);
    expect(r.complete).toBe(false);
  });

  it('marks complete after 4 plays', () => {
    let t: CurrentTrick = startTrick(1);
    const cards: Card[] = [c('hearts', '7'), c('hearts', 'K'), c('hearts', '2'), c('hearts', 'A')];
    for (let i = 0; i < 4; i++) {
      const r = playCardInTrick(t, ((i % 4) + 1) as any, cards[i]);
      if (!r.ok) throw new Error('expected ok');
      t = r.trick;
      if (i < 3) expect(r.complete).toBe(false);
      else expect(r.complete).toBe(true);
    }
  });
});

describe('resolveTrick', () => {
  it('all same led suit, no trump: highest of led suit wins', () => {
    const trick: CurrentTrick = {
      ledBy: 1,
      ledSuit: 'hearts',
      plays: [
        { seat: 1, card: c('hearts', '7') },
        { seat: 2, card: c('hearts', 'K') },
        { seat: 3, card: c('hearts', '2') },
        { seat: 4, card: c('hearts', 'A') },
      ],
    };
    const w = resolveTrick(trick, 'spades');
    expect(w).toBe(4); // Ace of hearts wins (no trump played)
  });

  it('trump played wins over led suit', () => {
    const trick: CurrentTrick = {
      ledBy: 1,
      ledSuit: 'hearts',
      plays: [
        { seat: 1, card: c('hearts', 'A') },
        { seat: 2, card: c('spades', '2') }, // trump
        { seat: 3, card: c('hearts', 'K') },
        { seat: 4, card: c('clubs', 'J') },   // off-suit, fuse
      ],
    };
    const w = resolveTrick(trick, 'spades');
    expect(w).toBe(2); // 2 of spades beats A of hearts
  });

  it('multiple trumps: highest trump wins', () => {
    const trick: CurrentTrick = {
      ledBy: 1,
      ledSuit: 'hearts',
      plays: [
        { seat: 1, card: c('hearts', 'A') },
        { seat: 2, card: c('spades', '2') },
        { seat: 3, card: c('spades', 'K') }, // highest trump
        { seat: 4, card: c('spades', 'Q') },
      ],
    };
    const w = resolveTrick(trick, 'spades');
    expect(w).toBe(3);
  });

  it('fuse cards (non-led non-trump) cannot win', () => {
    const trick: CurrentTrick = {
      ledBy: 1,
      ledSuit: 'hearts',
      plays: [
        { seat: 1, card: c('hearts', '2') },
        { seat: 2, card: c('clubs', 'A') }, // fuse
        { seat: 3, card: c('diamonds', 'A') }, // fuse
        { seat: 4, card: c('hearts', '3') },
      ],
    };
    const w = resolveTrick(trick, 'spades');
    expect(w).toBe(4); // 3 of hearts wins; both Aces are fuses
  });
});
```

Run `npm test` → expect failures.

- [ ] **Step 2: Implement**

Create `src/server/game/trick.ts`:

```typescript
import {
  type Card,
  type CurrentTrick,
  type Seat,
  type Suit,
  type PlayCardResult,
} from '@/shared/types';

export function startTrick(ledBy: Seat): CurrentTrick {
  return { ledBy, ledSuit: null, plays: [] };
}

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

export function isLegalPlay(trick: CurrentTrick, hand: Card[], play: Card): boolean {
  if (trick.ledSuit === null) return true;
  const hasLedSuit = hand.some((c) => c.suit === trick.ledSuit);
  if (!hasLedSuit) return true;
  return play.suit === trick.ledSuit;
}

export interface PlayResult {
  ok: true;
  trick: CurrentTrick;
  complete: boolean;
}

export function playCardInTrick(
  trick: CurrentTrick,
  seat: Seat,
  card: Card,
): PlayResult | { ok: false; error: PlayCardResult extends { ok: false; error: infer E } ? E : never } {
  // Note: this function does not check "is it your turn" or "is the card in your hand";
  // those are room-level concerns. It only updates the trick state.
  const plays = [...trick.plays, { seat, card }];
  const ledSuit = trick.ledSuit ?? card.suit;
  return {
    ok: true,
    trick: { ledBy: trick.ledBy, ledSuit, plays },
    complete: plays.length === 4,
  };
}

/** Determine the winning seat of a completed (4-play) trick. */
export function resolveTrick(trick: CurrentTrick, trump: Suit): Seat {
  if (trick.plays.length !== 4 || trick.ledSuit === null) {
    throw new Error('resolveTrick: trick is not complete');
  }

  const trumpPlays = trick.plays.filter((p) => p.card.suit === trump);
  const candidates = trumpPlays.length > 0
    ? trumpPlays
    : trick.plays.filter((p) => p.card.suit === trick.ledSuit);

  let best = candidates[0];
  for (const p of candidates) {
    if (RANK_VALUE[p.card.rank] > RANK_VALUE[best.card.rank]) {
      best = p;
    }
  }
  return best.seat;
}
```

Run `npm test` → all pass.

- [ ] **Step 3: Commit**

```bash
git add src/server/game/trick.ts tests/unit/trick.test.ts
git commit -m "Add trick state machine: startTrick, isLegalPlay, playCardInTrick, resolveTrick"
```

---

## Task 4: Strip partnerSeat from broadcasts; update view.ts

**Files:**
- Modify: `src/server/game/view.ts`
- Modify: `tests/unit/view.test.ts`

- [ ] **Step 1: Update view.ts**

Replace `src/server/game/view.ts`:

```typescript
import type { RoomServerState, RoomView, GameState } from '@/shared/types';

/**
 * Project a server-internal room into the wire format.
 *
 * Strips:
 * - `hands` (top-level server-only field)
 * - `game.partnerSeat` (server-only — public counterpart is `revealedPartnerSeat`)
 */
export function toRoomView(state: RoomServerState): RoomView {
  const { hands: _hands, game, ...rest } = state;
  if (game === null) {
    return { ...rest, game: null };
  }
  // Strip partnerSeat from the game projection.
  const { partnerSeat: _partnerSeat, ...publicGame } = game as GameState & { partnerSeat: unknown };
  return { ...rest, game: publicGame as GameState };
}
```

Wait — `GameState` itself includes `partnerSeat`, so this projection would strip the field but `RoomView['game']` still expects `partnerSeat` in its shape. Two options:

**Option A (recommended):** introduce a `PublicGameState` type and have `RoomView.game` use that instead of `GameState`.

Replace the relevant types in `src/shared/types.ts`:

```typescript
/** Server-internal game state (includes private partnerSeat). */
export interface GameState {
  bid: BidState;
  trumpPartner: TrumpPartnerChoice | null;
  currentTrick: CurrentTrick | null;
  completedTricks: CompletedTrick[];
  /** Server-only. The public projection is `revealedPartnerSeat` (below). */
  partnerSeat: Seat | null;
  revealedPartnerSeat: Seat | null;
}

/** Wire-format game state (no partnerSeat). */
export type PublicGameState = Omit<GameState, 'partnerSeat'>;

export interface RoomView extends Room {
  game: PublicGameState | null;
}

export interface RoomServerState extends Room {
  game: GameState | null;
  hands: Record<Seat, Card[]> | null;
}
```

Note `RoomServerState` no longer extends `RoomView` (different `game` shapes) — they both extend `Room` directly. Update any place that relied on the previous inheritance chain.

Then `toRoomView`:

```typescript
import type { RoomServerState, RoomView, PublicGameState } from '@/shared/types';

export function toRoomView(state: RoomServerState): RoomView {
  const { hands: _hands, game, ...rest } = state;
  if (game === null) return { ...rest, game: null };
  const { partnerSeat: _ps, ...publicGame } = game;
  return { ...rest, game: publicGame as PublicGameState };
}
```

- [ ] **Step 2: Update view.test.ts**

Modify `tests/unit/view.test.ts` to test the new stripping behavior:

```typescript
// existing test still applies: view has no `hands`. ADD this test:

it('strips partnerSeat from game when game is set', () => {
  const state: RoomServerState = {
    code: 'ABCD', hostId: 'h1', phase: 'play',
    players: [], chat: [], createdAt: 1,
    hands: null,
    game: {
      bid: { currentBid: 90, currentBidderSeat: 1, passedSeats: [2, 3, 4], complete: true },
      trumpPartner: { trump: 'spades', calledCard: { suit: 'hearts', rank: 'A' } },
      currentTrick: null,
      completedTricks: [],
      partnerSeat: 2,
      revealedPartnerSeat: null,
    },
  };
  const view = toRoomView(state);
  expect(view.game).not.toBeNull();
  expect('partnerSeat' in (view.game ?? {})).toBe(false);
  expect(view.game?.revealedPartnerSeat).toBeNull();
});
```

Update the existing test to fix the `game.bid` shape (still works since `bid` is unchanged), but note that the sample input now needs `trumpPartner: null, currentTrick: null, completedTricks: [], partnerSeat: null, revealedPartnerSeat: null` because the GameState type widened.

Run `npm test` → 4+ tests pass for view.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npm run lint && npm test
git add src/shared/types.ts src/server/game/view.ts tests/unit/view.test.ts
git commit -m "Split GameState (server) and PublicGameState (wire); strip partnerSeat from broadcasts"
```

---

## Task 5: Room manager — chooseTrumpPartnerInRoom, playCardInRoom, phase transitions

**Files:**
- Modify: `src/server/rooms.ts`

- [ ] **Step 1: Add the two new action functions**

In `src/server/rooms.ts`, import the new helpers at the top:

```typescript
import { validateTrumpPartnerChoice } from './game/trump-partner';
import { startTrick, isLegalPlay, playCardInTrick, resolveTrick } from './game/trick';
import { cardKey } from '@/shared/types';
import type { Card, TrumpPartnerChoice, CompletedTrick } from '@/shared/types';
```

Also UPDATE `startGame` and `createRoom` to initialize the new game-state fields. In `createRoom`, the `game: null` line stays the same. In `startGame`, the assignment changes:

```typescript
  room.game = {
    bid: emptyBidState(),
    trumpPartner: null,
    currentTrick: null,
    completedTricks: [],
    partnerSeat: null,
    revealedPartnerSeat: null,
  };
```

Then append two new exported functions:

```typescript
type TrumpPartnerInRoomResult =
  | { ok: true; room: RoomServerState }
  | { ok: false; error: 'NOT_BIDDER' | 'INVALID_CARD' | 'OWN_CARD' | 'NOT_IN_GAME' };

export function chooseTrumpPartnerInRoom(input: {
  code: string;
  seat: Seat;
  trump: import('@/shared/types').Suit;
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

  // Whose turn is it? The (ledBy + plays.length) seat (clockwise).
  const nextSeatIndex = (trick.ledBy - 1 + trick.plays.length) % 4;
  const expectedSeat = (nextSeatIndex + 1) as Seat;
  if (input.seat !== expectedSeat) return { ok: false, error: 'NOT_YOUR_TURN' };

  const hand = room.hands[input.seat];
  const handHasCard = hand.some((c) => cardKey(c) === cardKey(input.card));
  if (!handHasCard) return { ok: false, error: 'NOT_IN_HAND' };

  if (!isLegalPlay(trick, hand, input.card)) {
    return { ok: false, error: 'MUST_FOLLOW_SUIT' };
  }

  // Remove from hand, append to trick.
  room.hands[input.seat] = hand.filter((c) => cardKey(c) !== cardKey(input.card));
  const r = playCardInTrick(trick, input.seat, input.card);
  if (!r.ok) return { ok: false, error: 'NOT_IN_GAME' }; // shouldn't happen
  room.game.currentTrick = r.trick;

  // Reveal partner if the called card just got played.
  const called = room.game.trumpPartner.calledCard;
  if (cardKey(input.card) === cardKey(called)) {
    room.game.revealedPartnerSeat = input.seat;
  }

  // If trick complete: resolve, store, start next trick OR advance to 'end'.
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
      room.phase = 'end';
      room.game.currentTrick = null;
    } else {
      room.game.currentTrick = startTrick(winnerSeat);
    }
  }

  return { ok: true, room };
}
```

- [ ] **Step 2: Run all tests; existing tests should still pass**

Run `npm test`. The `startGame` test added in Plan 2 may need a small update to reflect the wider GameState (it checks `res.room.game!.bid.currentBid` which still works, but if it also checks `res.room.game!.trumpPartner` or similar, update). Most likely it still passes.

- [ ] **Step 3: Verify TS + lint clean**

Run: `npx tsc --noEmit && npm run lint` → both 0.

- [ ] **Step 4: Commit**

```bash
git add src/server/rooms.ts
git commit -m "Add chooseTrumpPartnerInRoom and playCardInRoom with trick resolution"
```

---

## Task 6: Socket handlers — trump:choose + card:play

**Files:**
- Modify: `src/server/socket.ts`
- Modify: `tests/unit/socket.test.ts`

- [ ] **Step 1: Add socket integration tests**

Append to `tests/unit/socket.test.ts`:

```typescript
import type { Suit, Card } from '@/shared/types';

async function setupAndStart(makeClient: () => any, host: any, c2: any, c3: any, c4: any) {
  const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
  const code = created.room.code;
  for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
    await new Promise<void>((resolve) => client.emit('room:join', { code, name }, () => resolve()));
  }
  const hands: Record<number, Card[]> = {};
  const handPromises = [host, c2, c3, c4].map((c, i) => new Promise<void>((resolve) => {
    c.once('hand:update', (p: any) => { hands[i + 1] = p.hand; resolve(); });
  }));
  await new Promise((resolve) => host.emit('room:start', resolve));
  await Promise.all(handPromises);
  // host bids 90; everyone passes.
  await new Promise((resolve) => host.emit('bid:place', { amount: 90 }, resolve));
  for (const c of [c2, c3, c4]) {
    await new Promise((resolve) => c.emit('bid:pass', resolve));
  }
  return { code, hands };
}

describe('socket: trump:choose', () => {
  it('bidder picks trump + an opponent card; phase advances to play', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const { hands } = await setupAndStart(makeClient, host, c2, c3, c4);

    // Pick a card NOT in host's hand (seats 2/3/4 hold the rest).
    const target = hands[2][0]; // first card of seat 2 is always not in host (seat 1)

    const ack: any = await new Promise((resolve) =>
      host.emit('trump:choose', { trump: 'spades', calledCard: target }, resolve)
    );
    expect(ack.ok).toBe(true);

    // All clients should observe phase=play and trumpPartner set
    await Promise.all(clients.map(c => new Promise<void>((resolve) => {
      const h = (s: any) => {
        if (s.phase === 'play' && s.game?.trumpPartner) { c.off('room:state', h); resolve(); }
      };
      c.on('room:state', h);
    })));

    clients.forEach((c) => c.disconnect());
  });
});

describe('socket: card:play', () => {
  it('bidder plays a card; legal first lead sets ledSuit; trick gets one play', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const { hands } = await setupAndStart(makeClient, host, c2, c3, c4);

    // host (seat 1) picks trump=spades, calls seat 2's first card
    const target = hands[2][0];
    await new Promise((resolve) =>
      host.emit('trump:choose', { trump: 'spades', calledCard: target }, resolve)
    );
    // wait for play phase
    await Promise.all(clients.map(c => new Promise<void>((resolve) => {
      const h = (s: any) => {
        if (s.phase === 'play') { c.off('room:state', h); resolve(); }
      };
      c.on('room:state', h);
    })));

    // host plays their first card
    const firstCard = hands[1][0];
    const playState = new Promise<any>((resolve) => {
      const h = (s: any) => {
        if (s.game?.currentTrick?.plays.length === 1) {
          c2.off('room:state', h);
          resolve(s);
        }
      };
      c2.on('room:state', h);
    });
    const ack: any = await new Promise((resolve) => host.emit('card:play', { card: firstCard }, resolve));
    expect(ack.ok).toBe(true);

    const state = await playState;
    expect(state.game.currentTrick.plays).toHaveLength(1);
    expect(state.game.currentTrick.ledSuit).toBe(firstCard.suit);

    clients.forEach((c) => c.disconnect());
  });

  it('rejects NOT_YOUR_TURN when a non-leader tries to play first', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2, c3, c4] = clients;
    const { hands } = await setupAndStart(makeClient, host, c2, c3, c4);

    const target = hands[2][0];
    await new Promise((resolve) =>
      host.emit('trump:choose', { trump: 'spades', calledCard: target }, resolve)
    );
    await Promise.all(clients.map(c => new Promise<void>((resolve) => {
      const h = (s: any) => { if (s.phase === 'play') { c.off('room:state', h); resolve(); } };
      c.on('room:state', h);
    })));

    // c2 (seat 2) tries to play first — bidder (seat 1) should be first.
    const ack: any = await new Promise((resolve) => c2.emit('card:play', { card: hands[2][0] }, resolve));
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('NOT_YOUR_TURN');

    clients.forEach((c) => c.disconnect());
  });
});
```

Run `npm test` → expect failures.

- [ ] **Step 2: Add the socket handlers**

In `src/server/socket.ts`, import `chooseTrumpPartnerInRoom`, `playCardInRoom`. Add handlers before `disconnect`:

```typescript
    socket.on('trump:choose', ({ trump, calledCard }, cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const room = getRoom(roomCode);
      if (!room) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const player = room.players.find((p) => p.id === sessionId);
      if (!player) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const res = chooseTrumpPartnerInRoom({ code: roomCode, seat: player.seat, trump, calledCard });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      broadcastState(io, res.room);
    });

    socket.on('card:play', ({ card }, cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const room = getRoom(roomCode);
      if (!room) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const player = room.players.find((p) => p.id === sessionId);
      if (!player) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const res = playCardInRoom({ code: roomCode, seat: player.seat, card });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      // Re-broadcast hands too — player's hand just changed.
      broadcastHands(io, res.room);
      broadcastState(io, res.room);
    });
```

- [ ] **Step 3: Run all tests; expect new ones to pass**

Run `npm test`. Total should be ~74 (68 + 3 new tests in trick + 5 new in trump-partner + 2 in socket).

Wait, recount. After Tasks 2, 3, 4, 6:
- Plan 2: 68 tests
- Task 2 trump-partner: 5 tests = 73
- Task 3 trick: 9 tests = 82
- Task 4 view: +1 test (new assert about partnerSeat strip) = 83
- Task 6 socket: 3 tests = 86

Total ~86 tests should pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/socket.ts tests/unit/socket.test.ts
git commit -m "Wire trump:choose and card:play socket events"
```

---

## Task 7: Refactor page.tsx — extract JoinView, WaitingRoomView, BiddingView

**Files:**
- Create: `src/components/views/JoinView.tsx`
- Create: `src/components/views/WaitingRoomView.tsx`
- Create: `src/components/views/BiddingView.tsx`
- Create: `src/components/shared/seatNameFor.ts`
- Modify: `src/app/room/[code]/page.tsx`

This task is a pure refactor — no behavior change. Confirms the page can be sliced cleanly before adding TrumpPartner + TrickPlay views in subsequent tasks.

- [ ] **Step 1: Add a small helper `seatNameFor`**

Create `src/components/shared/seatNameFor.ts`:

```typescript
import type { Player } from '@/shared/types';

export function seatNameFor(players: Player[], seat: number | null): string {
  if (seat === null) return '—';
  const p = players.find((p) => p.seat === seat);
  return p?.name ?? `seat ${seat}`;
}
```

- [ ] **Step 2: Extract JoinView**

Create `src/components/views/JoinView.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { JoinRoomResult } from '@/shared/types';

interface JoinViewProps {
  code: string;
  onSubmit: (name: string) => Promise<JoinRoomResult>;
}

export function JoinView({ code, onSubmit }: JoinViewProps) {
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr('Pick a display name'); return; }
    setBusy(true);
    const res = await onSubmit(name.trim());
    setBusy(false);
    if (!res.ok) {
      setErr(
        res.error === 'NOT_FOUND' ? 'Room not found.'
        : res.error === 'FULL' ? 'Room is full.'
        : res.error === 'NAME_TAKEN' ? 'Name is taken.'
        : 'Invalid name.'
      );
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">
      <div className="text-center">
        <div className="text-gold-500 text-5xl font-serif leading-none">♛</div>
        <div className="text-xl font-bold mt-1">Black Queen</div>
      </div>
      <div className="w-80 bg-black/40 border border-white/10 rounded-xl p-5">
        <div className="text-center text-xs text-neutral-400">You&apos;ve been invited to room</div>
        <div className="text-center text-lg font-mono font-bold text-gold-500 mt-1">{code}</div>
        <form onSubmit={handle} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">Your display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500"
              placeholder="Pick something fun"
            />
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-black font-bold rounded-lg py-2.5 text-sm">
            Join room
          </button>
          {err && <div className="text-red-400 text-xs text-center">{err}</div>}
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Extract WaitingRoomView**

Create `src/components/views/WaitingRoomView.tsx`:

```tsx
'use client';
import type { RoomView, Player, Seat } from '@/shared/types';
import { Seat as SeatComp } from '@/components/Seat';
import { InviteCard } from '@/components/InviteCard';
import { StartCard } from '@/components/StartCard';
import { ChatPanel } from '@/components/ChatPanel';

function rotate(viewerSeat: Seat) {
  return {
    bottom: viewerSeat,
    left: (viewerSeat % 4) + 1,
    top: ((viewerSeat + 1) % 4) + 1,
    right: ((viewerSeat + 2) % 4) + 1,
  };
}

interface Props {
  room: RoomView;
  me: Player;
  sessionId: string;
  onStart: () => void;
  onSendChat: (text: string) => void;
}

export function WaitingRoomView({ room, me, sessionId, onStart, onSendChat }: Props) {
  const layout = rotate(me.seat);
  const at = (seat: number): Player | null => room.players.find((p) => p.seat === seat) ?? null;
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${room.code}` : `/room/${room.code}`;
  const isHost = room.hostId === sessionId;
  const isFull = room.players.length >= 4;

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
        <div className="absolute top-0 left-1/2 -translate-x-1/2"><SeatComp player={at(layout.top)} seatLabel={`seat ${layout.top}`} isHost={!!at(layout.top) && at(layout.top)!.id === room.hostId} /></div>
        <div className="absolute top-1/2 left-8 -translate-y-1/2"><SeatComp player={at(layout.left)} seatLabel={`seat ${layout.left}`} isHost={!!at(layout.left) && at(layout.left)!.id === room.hostId} /></div>
        <div className="absolute top-1/2 right-8 -translate-y-1/2"><SeatComp player={at(layout.right)} seatLabel={`seat ${layout.right}`} isHost={!!at(layout.right) && at(layout.right)!.id === room.hostId} /></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2"><SeatComp player={me} seatLabel={`seat ${layout.bottom}`} isYou isHost={isHost} /></div>
      </div>
      <div className="flex justify-center gap-4 mt-4">
        <InviteCard code={room.code} url={inviteUrl} disabled={isFull} />
        <StartCard filled={room.players.length} isHost={isHost} onStart={onStart} />
      </div>
      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
```

- [ ] **Step 4: Extract BiddingView**

Create `src/components/views/BiddingView.tsx`:

```tsx
'use client';
import type { RoomView, Player, Seat, Card } from '@/shared/types';
import { BidPanel } from '@/components/bidding/BidPanel';
import { StatusPill } from '@/components/bidding/StatusPill';
import { HandPreview } from '@/components/bidding/HandPreview';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';

function rotate(viewerSeat: Seat) {
  return { bottom: viewerSeat, left: (viewerSeat % 4) + 1, top: ((viewerSeat + 1) % 4) + 1, right: ((viewerSeat + 2) % 4) + 1 };
}

interface Props {
  room: RoomView;
  me: Player;
  yourHand: Card[];
  busy: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
  onSendChat: (text: string) => void;
}

export function BiddingView({ room, me, yourHand, busy, onBid, onPass, onSendChat }: Props) {
  const bid = room.game!.bid;
  const layout = rotate(me.seat);

  const seatStatus = (seat: number) => {
    if (bid.currentBidderSeat === seat) return { variant: 'bidder' as const, label: `bid ${bid.currentBid}` };
    if (bid.passedSeats.includes(seat as Seat)) return { variant: 'passed' as const, label: 'passed' };
    return { variant: 'live' as const, label: 'deciding…', pulse: true };
  };

  const nameAt = (seat: number) => seatNameFor(room.players, seat);

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-4">
          <div className="text-[10px] uppercase tracking-widest text-gold-500 font-bold">Bidding phase</div>
          <div className="text-xs text-neutral-400 mt-1">Min 75 · Max 150 · Increments of 5</div>
        </div>

        <div className="relative h-56 mb-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
            <div className="text-sm font-semibold">{nameAt(layout.top)}</div>
            <StatusPill {...seatStatus(layout.top)} />
          </div>
          <div className="absolute top-1/2 left-8 -translate-y-1/2 text-center">
            <div className="text-sm font-semibold">{nameAt(layout.left)}</div>
            <StatusPill {...seatStatus(layout.left)} />
          </div>
          <div className="absolute top-1/2 right-8 -translate-y-1/2 text-center">
            <div className="text-sm font-semibold">{nameAt(layout.right)}</div>
            <StatusPill {...seatStatus(layout.right)} />
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
            <BidPanel bid={bid} yourSeat={me.seat} busy={busy} onBid={onBid} onPass={onPass} />
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
      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
```

Also update BidPanel to show the bidder's NAME (passed as a prop). Edit `src/components/bidding/BidPanel.tsx`: replace `held by <b>seat {bid.currentBidderSeat}</b>` with `held by <b>{bidderName}</b>` where `bidderName` is a new prop. Pass `bidderName={nameAt(bid.currentBidderSeat ?? 0)}` from `BiddingView`. Skip if you'd rather defer this polish.

- [ ] **Step 5: Slim page.tsx to a router (lobby + bidding only for now; trump_partner + play in Task 12)**

Replace `src/app/room/[code]/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { selectMe, useGameStore } from '@/client/store';
import { JoinView } from '@/components/views/JoinView';
import { WaitingRoomView } from '@/components/views/WaitingRoomView';
import { BiddingView } from '@/components/views/BiddingView';
import type { BidActionAck, JoinRoomResult, StartGameResult } from '@/shared/types';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const socket = useSocket();

  const room = useGameStore((s) => s.room);
  const sessionId = useGameStore((s) => s.sessionId);
  const yourHand = useGameStore((s) => s.yourHand);
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const me = useGameStore(selectMe);
  const [bidBusy, setBidBusy] = useState(false);

  async function handleJoin(name: string): Promise<JoinRoomResult> {
    const res = await new Promise<JoinRoomResult>((resolve) =>
      socket.emit('room:join', { code, name }, resolve)
    );
    if (res.ok) { setSession(res.sessionId); setRoom(res.room); }
    return res;
  }
  const handleStart = () => socket.emit('room:start', (res: StartGameResult) => res.ok || console.warn('Start failed:', res.error));
  const handleSendChat = (text: string) => socket.emit('chat:send', { text });
  const handleBid = (amount: number) => {
    setBidBusy(true);
    socket.emit('bid:place', { amount }, (res: BidActionAck) => { setBidBusy(false); if (!res.ok) console.warn('Bid failed:', res.error); });
  };
  const handlePass = () => {
    setBidBusy(true);
    socket.emit('bid:pass', (res: BidActionAck) => { setBidBusy(false); if (!res.ok) console.warn('Pass failed:', res.error); });
  };

  if (!sessionId || !me) return <JoinView code={code} onSubmit={handleJoin} />;
  if (!room) return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;

  if (room.phase === 'lobby') {
    return <WaitingRoomView room={room} me={me} sessionId={sessionId} onStart={handleStart} onSendChat={handleSendChat} />;
  }
  if (room.phase === 'bidding') {
    return <BiddingView room={room} me={me} yourHand={yourHand} busy={bidBusy} onBid={handleBid} onPass={handlePass} onSendChat={handleSendChat} />;
  }
  // trump_partner + play + end land in Task 12.
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <div className="text-gold-500 text-5xl font-serif">♛</div>
      <div className="text-2xl font-bold">Phase: <span className="text-gold-500">{room.phase}</span></div>
      <div className="text-xs text-neutral-500 mt-2">(later in this plan.)</div>
    </main>
  );
}
```

- [ ] **Step 6: Verify nothing broke (unit + e2e)**

Run: `npm run lint && npm test && npm run test:e2e`
Expected: lint clean, 86 unit pass, 6 e2e pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/ src/app/room/
git commit -m "Refactor /room/[code] into phase-router; extract JoinView, WaitingRoomView, BiddingView"
```

---

## Task 8: TrumpPartnerModal + WaitingForChoice components

**Files:**
- Create: `src/components/trump-partner/TrumpPartnerModal.tsx`
- Create: `src/components/trump-partner/WaitingForChoice.tsx`

- [ ] **Step 1: TrumpPartnerModal**

Create `src/components/trump-partner/TrumpPartnerModal.tsx`:

```tsx
'use client';
import { useState } from 'react';
import type { Card, Suit, Rank } from '@/shared/types';
import { SUITS, RANKS, cardKey } from '@/shared/types';

interface Props {
  yourHand: Card[];
  busy?: boolean;
  onConfirm: (trump: Suit, calledCard: Card) => void;
}

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

export function TrumpPartnerModal({ yourHand, busy, onConfirm }: Props) {
  const [trump, setTrump] = useState<Suit | null>(null);
  const [called, setCalled] = useState<Card | null>(null);

  const ownedKeys = new Set(yourHand.map(cardKey));
  const canConfirm = trump !== null && called !== null;

  return (
    <div className="w-[560px] max-w-[95%] bg-black/90 border border-gold-500/40 rounded-2xl p-5 shadow-2xl">
      <div className="text-center mb-3">
        <div className="text-[9px] uppercase tracking-widest text-gold-500 font-bold">You won the bid</div>
        <div className="text-sm text-neutral-300 mt-1">Pick the trump suit and a partner card you don&apos;t have.</div>
      </div>

      <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1.5">1 · Trump suit</div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {SUITS.map((s) => {
          const isRed = s === 'hearts' || s === 'diamonds';
          const selected = trump === s;
          return (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => setTrump(s)}
              className={selected
                ? 'bg-gold-500 text-black border border-white py-2 rounded-lg font-bold disabled:opacity-50'
                : `bg-felt-800 hover:bg-felt-700 border border-white/20 hover:border-gold-500 py-2 rounded-lg disabled:opacity-50 ${isRed ? 'text-red-400' : 'text-white'}`}
            >
              <div className="text-xl leading-none">{SUIT_GLYPH[s]}</div>
              <div className="text-[9px] mt-1">{s}</div>
            </button>
          );
        })}
      </div>

      <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1.5">2 · Partner card (not in your hand)</div>
      <div className="space-y-1">
        {SUITS.map((suit) => {
          const isRed = suit === 'hearts' || suit === 'diamonds';
          return (
            <div key={suit} className="flex items-center gap-1">
              <div className={`w-4 text-center ${isRed ? 'text-red-400' : 'text-white'}`}>{SUIT_GLYPH[suit]}</div>
              <div className="grid grid-cols-13 gap-1 flex-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                {RANKS.map((rank: Rank) => {
                  const card: Card = { suit, rank };
                  const k = cardKey(card);
                  const owned = ownedKeys.has(k);
                  const selected = called && cardKey(called) === k;
                  const baseColor = isRed ? 'text-red-400' : 'text-black';
                  return (
                    <button
                      key={rank}
                      type="button"
                      disabled={owned || busy}
                      onClick={() => setCalled(card)}
                      className={selected
                        ? 'bg-gold-500 text-black font-bold rounded h-6 text-[11px] border border-white shadow disabled:opacity-50'
                        : owned
                        ? 'bg-white/5 text-neutral-600 rounded h-6 text-[11px] border border-dashed border-white/15 cursor-not-allowed'
                        : `bg-white hover:-translate-y-px ${baseColor} rounded h-6 text-[11px] font-bold disabled:opacity-50 shadow-sm transition-transform`}
                    >
                      {rank}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-between items-center bg-black/40 border border-white/15 rounded-lg px-3 py-2">
        <div className="text-xs text-neutral-300">
          Trump <span className="text-gold-500 font-bold">{trump ? SUIT_GLYPH[trump] : '—'}</span>
          {' · '}
          Partner <span className="text-pink-300 font-bold font-serif">{called ? `${called.rank}${SUIT_GLYPH[called.suit]}` : '—'}</span>
        </div>
        <button
          type="button"
          disabled={!canConfirm || busy}
          onClick={() => canConfirm && onConfirm(trump!, called!)}
          className="bg-gold-500 hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded-lg px-4 py-1.5 text-xs"
        >
          Lock it in
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: WaitingForChoice**

Create `src/components/trump-partner/WaitingForChoice.tsx`:

```tsx
interface Props {
  bidderName: string;
}

export function WaitingForChoice({ bidderName }: Props) {
  return (
    <div className="bg-black/80 border border-white/15 rounded-2xl p-6 text-center">
      <div className="text-gold-500 font-bold text-lg">{bidderName} is choosing</div>
      <div className="text-sm text-neutral-300 mt-1">Trump suit and partner card</div>
      <div className="flex gap-1.5 justify-center mt-3">
        <span className="w-2 h-2 bg-gold-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gold-500 rounded-full animate-pulse" style={{ animationDelay: '180ms' }} />
        <span className="w-2 h-2 bg-gold-500 rounded-full animate-pulse" style={{ animationDelay: '360ms' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TS + lint clean; commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/trump-partner/
git commit -m "Add TrumpPartnerModal and WaitingForChoice components"
```

---

## Task 9: TrumpPartnerView

**Files:**
- Create: `src/components/views/TrumpPartnerView.tsx`

- [ ] **Step 1: Implement**

Create `src/components/views/TrumpPartnerView.tsx`:

```tsx
'use client';
import type { RoomView, Player, Card, Suit } from '@/shared/types';
import { TrumpPartnerModal } from '@/components/trump-partner/TrumpPartnerModal';
import { WaitingForChoice } from '@/components/trump-partner/WaitingForChoice';
import { HandPreview } from '@/components/bidding/HandPreview';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';

interface Props {
  room: RoomView;
  me: Player;
  yourHand: Card[];
  busy: boolean;
  onConfirm: (trump: Suit, called: Card) => void;
  onSendChat: (text: string) => void;
}

export function TrumpPartnerView({ room, me, yourHand, busy, onConfirm, onSendChat }: Props) {
  const bidderSeat = room.game?.bid.currentBidderSeat ?? null;
  const bidderName = seatNameFor(room.players, bidderSeat);
  const isBidder = bidderSeat === me.seat;

  return (
    <main className="min-h-screen p-6 flex flex-col items-center gap-4">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-widest text-gold-500 font-bold">Trump &amp; partner</div>
        <div className="text-xs text-neutral-400 mt-1">Bid {room.game?.bid.currentBid} · {bidderName}</div>
      </div>

      {isBidder ? (
        <TrumpPartnerModal yourHand={yourHand} busy={busy} onConfirm={onConfirm} />
      ) : (
        <WaitingForChoice bidderName={bidderName} />
      )}

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500 text-center mb-2">your hand</div>
        <HandPreview hand={yourHand} />
      </div>

      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
```

- [ ] **Step 2: TS + lint clean; commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/views/TrumpPartnerView.tsx
git commit -m "Add TrumpPartnerView (bidder modal + others' waiting screen)"
```

---

## Task 10: Trick play visual components

**Files:**
- Create: `src/components/play/CardBack.tsx`
- Create: `src/components/play/OpponentFan.tsx`
- Create: `src/components/play/PlayedCardsCenter.tsx`
- Create: `src/components/play/PlayerHand.tsx`
- Create: `src/components/play/InfoBadges.tsx`

- [ ] **Step 1: CardBack**

Create `src/components/play/CardBack.tsx`:

```tsx
interface Props {
  size?: 'sm' | 'md';
  rotateDeg?: number;
}

const SIZES = {
  sm: 'w-8 h-12',
  md: 'w-10 h-14',
};

export function CardBack({ size = 'sm', rotateDeg = 0 }: Props) {
  return (
    <div
      className={`${SIZES[size]} rounded shadow border border-blue-300/60`}
      style={{
        background:
          'repeating-linear-gradient(45deg, #1c3a6e 0, #1c3a6e 3px, #254a85 3px, #254a85 6px)',
        transform: `rotate(${rotateDeg}deg)`,
      }}
    />
  );
}
```

- [ ] **Step 2: OpponentFan**

Create `src/components/play/OpponentFan.tsx`:

```tsx
import { CardBack } from './CardBack';

interface Props {
  /** Number of cards in the opponent's hand. */
  count: number;
  /** 'top' fans down, 'left' fans right (rotated), 'right' fans left (rotated). */
  orientation: 'top' | 'left' | 'right';
}

export function OpponentFan({ count, orientation }: Props) {
  if (count <= 0) return null;
  const cards = Array.from({ length: count });

  if (orientation === 'top') {
    const spread = Math.min(2, 18 / Math.max(count - 1, 1));
    return (
      <div className="flex justify-center items-end">
        {cards.map((_, i) => {
          const offsetFromCenter = i - (count - 1) / 2;
          const rot = offsetFromCenter * spread;
          return (
            <div key={i} style={{ marginLeft: i === 0 ? 0 : '-12px', transform: `rotate(${rot}deg)`, transformOrigin: 'bottom center' }}>
              <CardBack size="sm" />
            </div>
          );
        })}
      </div>
    );
  }

  // left / right — vertical fan, individual cards rotated 90° away.
  const baseRot = orientation === 'left' ? 90 : -90;
  return (
    <div className="flex flex-col justify-center items-center">
      {cards.map((_, i) => (
        <div key={i} style={{ marginTop: i === 0 ? 0 : '-10px', transform: `rotate(${baseRot}deg)` }}>
          <CardBack size="sm" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: PlayedCardsCenter**

Create `src/components/play/PlayedCardsCenter.tsx`:

```tsx
import { Card } from '@/components/Card';
import type { Card as CardType, PlayedCard, Seat } from '@/shared/types';

interface Props {
  plays: PlayedCard[];
  /** Where each seat's played card should appear, from this viewer's perspective. */
  viewerSeat: Seat;
}

/** Convert a seat number → visual position relative to viewer. */
function positionFor(viewerSeat: Seat, seat: Seat): 'top' | 'left' | 'right' | 'bottom' {
  const diff = (seat - viewerSeat + 4) % 4;
  if (diff === 0) return 'bottom';
  if (diff === 1) return 'left';
  if (diff === 2) return 'top';
  return 'right';
}

const POSITION_STYLE: Record<string, React.CSSProperties> = {
  top:    { top: 0, left: '50%', transform: 'translateX(-50%)' },
  left:   { left: 0, top: '50%', transform: 'translateY(-50%)' },
  right:  { right: 0, top: '50%', transform: 'translateY(-50%)' },
  bottom: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
};

export function PlayedCardsCenter({ plays, viewerSeat }: Props) {
  return (
    <div className="relative w-[180px] h-[180px] mx-auto">
      {plays.map(({ seat, card }) => {
        const pos = positionFor(viewerSeat, seat);
        return (
          <div key={`${seat}-${card.suit}-${card.rank}`} className="absolute" style={POSITION_STYLE[pos]}>
            <Card card={card} size="md" />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: PlayerHand**

Create `src/components/play/PlayerHand.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Card } from '@/components/Card';
import type { Card as CardType } from '@/shared/types';
import { cardKey } from '@/shared/types';

interface Props {
  hand: CardType[];
  /** Which cards are legal to play right now. If null, all are legal. */
  legalKeys: Set<string> | null;
  /** When true, your turn; otherwise hand is view-only. */
  active: boolean;
  onPlay: (card: CardType) => void;
}

const SUIT_ORDER = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

function sortHand(hand: CardType[]): CardType[] {
  return [...hand].sort((a, b) => {
    const s = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (s !== 0) return s;
    return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  });
}

export function PlayerHand({ hand, legalKeys, active, onPlay }: Props) {
  const sorted = sortHand(hand);
  const [stagedKey, setStagedKey] = useState<string | null>(null);
  const n = sorted.length;
  const maxRot = 22;
  const step = n > 1 ? (maxRot * 2) / (n - 1) : 0;

  function handleClick(card: CardType) {
    if (!active) return;
    const k = cardKey(card);
    if (legalKeys && !legalKeys.has(k)) return; // illegal
    if (stagedKey === k) {
      onPlay(card);
      setStagedKey(null);
      return;
    }
    setStagedKey(k);
  }

  return (
    <div className="relative h-32">
      <div className="flex justify-center items-end h-full">
        {sorted.map((card, i) => {
          const k = cardKey(card);
          const rot = -maxRot + step * i;
          const isStaged = stagedKey === k;
          const isLegal = !legalKeys || legalKeys.has(k);
          const dim = active && !isLegal;
          return (
            <div
              key={k}
              onClick={() => handleClick(card)}
              className={`transition-transform cursor-pointer ${active && isLegal ? 'hover:-translate-y-3' : ''} ${dim ? 'opacity-30 cursor-not-allowed' : ''}`}
              style={{
                marginLeft: i === 0 ? 0 : '-26px',
                transform: `rotate(${rot}deg) ${isStaged ? 'translateY(-32px) scale(1.1)' : ''}`,
                zIndex: isStaged ? 50 : i,
              }}
            >
              <Card card={card} size="md" />
            </div>
          );
        })}
      </div>
      {stagedKey && active && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 text-[11px] bg-gold-500 text-black font-bold px-3 py-1 rounded shadow">
          Click again to play
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: InfoBadges**

Create `src/components/play/InfoBadges.tsx`:

```tsx
import type { PublicGameState, Card, Suit } from '@/shared/types';

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

interface Props {
  game: PublicGameState;
  bidderName: string;
  partnerName: string | null;
}

export function InfoBadges({ game, bidderName, partnerName }: Props) {
  const tp = game.trumpPartner;
  if (!tp) return null;
  return (
    <div className="flex flex-col gap-1.5 absolute top-3 left-3">
      <div className="bg-black/60 border border-white/15 rounded px-2 py-1 text-xs text-white font-mono">
        Trump <span className="text-gold-500 font-bold">{SUIT_GLYPH[tp.trump]}</span>
      </div>
      <div className="bg-black/60 border border-white/15 rounded px-2 py-1 text-xs text-white">
        Bid <b className="text-gold-500">{game.bid.currentBid}</b> · {bidderName}
      </div>
      <div className="bg-black/60 border border-white/15 rounded px-2 py-1 text-xs text-white">
        Called <span className="text-pink-300 font-bold font-serif">{tp.calledCard.rank}{SUIT_GLYPH[tp.calledCard.suit]}</span>
        {partnerName && <span className="text-neutral-400"> · {partnerName}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: TS + lint clean; commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/play/
git commit -m "Add trick-play components: CardBack, OpponentFan, PlayedCardsCenter, PlayerHand, InfoBadges"
```

---

## Task 11: TrickPlayView

**Files:**
- Create: `src/components/views/TrickPlayView.tsx`

- [ ] **Step 1: Implement**

Create `src/components/views/TrickPlayView.tsx`:

```tsx
'use client';
import type { RoomView, Player, Card, Seat } from '@/shared/types';
import { CardBack } from '@/components/play/CardBack';
import { OpponentFan } from '@/components/play/OpponentFan';
import { PlayedCardsCenter } from '@/components/play/PlayedCardsCenter';
import { PlayerHand } from '@/components/play/PlayerHand';
import { InfoBadges } from '@/components/play/InfoBadges';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';
import { cardKey } from '@/shared/types';

interface Props {
  room: RoomView;
  me: Player;
  yourHand: Card[];
  onPlay: (card: Card) => void;
  onSendChat: (text: string) => void;
}

function rotate(viewerSeat: Seat) {
  return {
    bottom: viewerSeat,
    left: (viewerSeat % 4) + 1,
    top: ((viewerSeat + 1) % 4) + 1,
    right: ((viewerSeat + 2) % 4) + 1,
  };
}

/** Cards remaining for each opponent. 13 at start, decrements as they play. */
function opponentCardCount(room: RoomView, seat: Seat): number {
  const game = room.game;
  if (!game) return 0;
  // 13 - (completed tricks won by anyone, where this seat played)
  //    - (cards in currentTrick by this seat)
  let played = 0;
  for (const t of game.completedTricks) {
    if (t.plays.some((p) => p.seat === seat)) played += 1;
  }
  if (game.currentTrick) {
    if (game.currentTrick.plays.some((p) => p.seat === seat)) played += 1;
  }
  return Math.max(0, 13 - played);
}

export function TrickPlayView({ room, me, yourHand, onPlay, onSendChat }: Props) {
  const game = room.game!;
  const layout = rotate(me.seat);

  const bidderSeat = game.bid.currentBidderSeat;
  const bidderName = seatNameFor(room.players, bidderSeat);
  const partnerSeat = game.revealedPartnerSeat;
  const partnerName = partnerSeat !== null ? seatNameFor(room.players, partnerSeat) : null;

  // Whose turn is it?
  const trick = game.currentTrick;
  let nextSeat: Seat | null = null;
  if (trick) {
    nextSeat = (((trick.ledBy - 1 + trick.plays.length) % 4) + 1) as Seat;
  }
  const isMyTurn = nextSeat === me.seat;

  // Legal moves: must follow led suit if you have it.
  let legalKeys: Set<string> | null = null;
  if (isMyTurn && trick) {
    if (trick.ledSuit !== null) {
      const hasLedSuit = yourHand.some((c) => c.suit === trick.ledSuit);
      if (hasLedSuit) {
        legalKeys = new Set(yourHand.filter((c) => c.suit === trick.ledSuit).map(cardKey));
      } else {
        legalKeys = new Set(yourHand.map(cardKey));
      }
    } else {
      legalKeys = new Set(yourHand.map(cardKey)); // first lead: any card
    }
  }

  return (
    <main className="min-h-screen relative bg-felt-900 p-6">
      <InfoBadges game={game} bidderName={bidderName} partnerName={partnerName} />

      {/* Opponent seats */}
      <div className="relative max-w-4xl mx-auto mt-6 h-[380px]">
        {/* Top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
          <OpponentFan count={opponentCardCount(room, layout.top as Seat)} orientation="top" />
          <div className="text-xs font-semibold text-white mt-1">{seatNameFor(room.players, layout.top)}</div>
          {nextSeat === layout.top && <div className="text-[10px] text-gold-500 animate-pulse">thinking…</div>}
        </div>
        {/* Left */}
        <div className="absolute top-1/2 left-2 -translate-y-1/2 text-center">
          <OpponentFan count={opponentCardCount(room, layout.left as Seat)} orientation="left" />
          <div className="text-xs font-semibold text-white mt-1">{seatNameFor(room.players, layout.left)}</div>
          {nextSeat === layout.left && <div className="text-[10px] text-gold-500 animate-pulse">thinking…</div>}
        </div>
        {/* Right */}
        <div className="absolute top-1/2 right-2 -translate-y-1/2 text-center">
          <OpponentFan count={opponentCardCount(room, layout.right as Seat)} orientation="right" />
          <div className="text-xs font-semibold text-white mt-1">{seatNameFor(room.players, layout.right)}</div>
          {nextSeat === layout.right && <div className="text-[10px] text-gold-500 animate-pulse">thinking…</div>}
        </div>

        {/* Center: played cards */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {trick && <PlayedCardsCenter plays={trick.plays} viewerSeat={me.seat} />}
        </div>
      </div>

      {/* Your hand */}
      <div className="max-w-4xl mx-auto mt-4">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500 text-center mb-1">
          {isMyTurn ? <span className="text-gold-500">Your turn</span> : 'Waiting…'}
        </div>
        <PlayerHand hand={yourHand} legalKeys={legalKeys} active={isMyTurn} onPlay={onPlay} />
        <div className="text-center mt-2 text-xs text-white font-semibold">{me.name} (you)</div>
      </div>

      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
```

- [ ] **Step 2: TS + lint clean; commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/views/TrickPlayView.tsx
git commit -m "Add TrickPlayView with opponent fans, played-cards center, and interactive hand"
```

---

## Task 12: Wire trump_partner + play phases into page.tsx

**Files:**
- Modify: `src/app/room/[code]/page.tsx`

- [ ] **Step 1: Add the trump_partner and play branches**

Replace the placeholder fallback in `src/app/room/[code]/page.tsx` with the full router:

```tsx
'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { selectMe, useGameStore } from '@/client/store';
import { JoinView } from '@/components/views/JoinView';
import { WaitingRoomView } from '@/components/views/WaitingRoomView';
import { BiddingView } from '@/components/views/BiddingView';
import { TrumpPartnerView } from '@/components/views/TrumpPartnerView';
import { TrickPlayView } from '@/components/views/TrickPlayView';
import type {
  BidActionAck,
  JoinRoomResult,
  StartGameResult,
  TrumpPartnerActionAck,
  PlayCardAck,
  Suit,
  Card,
} from '@/shared/types';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const socket = useSocket();

  const room = useGameStore((s) => s.room);
  const sessionId = useGameStore((s) => s.sessionId);
  const yourHand = useGameStore((s) => s.yourHand);
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const me = useGameStore(selectMe);
  const [bidBusy, setBidBusy] = useState(false);
  const [tpBusy, setTpBusy] = useState(false);

  async function handleJoin(name: string): Promise<JoinRoomResult> {
    const res = await new Promise<JoinRoomResult>((resolve) =>
      socket.emit('room:join', { code, name }, resolve)
    );
    if (res.ok) { setSession(res.sessionId); setRoom(res.room); }
    return res;
  }
  const handleStart = () => socket.emit('room:start', (res: StartGameResult) => res.ok || console.warn('Start failed:', res.error));
  const handleSendChat = (text: string) => socket.emit('chat:send', { text });
  const handleBid = (amount: number) => {
    setBidBusy(true);
    socket.emit('bid:place', { amount }, (res: BidActionAck) => { setBidBusy(false); if (!res.ok) console.warn('Bid failed:', res.error); });
  };
  const handlePass = () => {
    setBidBusy(true);
    socket.emit('bid:pass', (res: BidActionAck) => { setBidBusy(false); if (!res.ok) console.warn('Pass failed:', res.error); });
  };
  const handleTpConfirm = (trump: Suit, called: Card) => {
    setTpBusy(true);
    socket.emit('trump:choose', { trump, calledCard: called }, (res: TrumpPartnerActionAck) => {
      setTpBusy(false);
      if (!res.ok) console.warn('Trump-partner failed:', res.error);
    });
  };
  const handleCardPlay = (card: Card) => {
    socket.emit('card:play', { card }, (res: PlayCardAck) => {
      if (!res.ok) console.warn('Play failed:', res.error);
    });
  };

  if (!sessionId || !me) return <JoinView code={code} onSubmit={handleJoin} />;
  if (!room) return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;

  if (room.phase === 'lobby') {
    return <WaitingRoomView room={room} me={me} sessionId={sessionId} onStart={handleStart} onSendChat={handleSendChat} />;
  }
  if (room.phase === 'bidding') {
    return <BiddingView room={room} me={me} yourHand={yourHand} busy={bidBusy} onBid={handleBid} onPass={handlePass} onSendChat={handleSendChat} />;
  }
  if (room.phase === 'trump_partner') {
    return <TrumpPartnerView room={room} me={me} yourHand={yourHand} busy={tpBusy} onConfirm={handleTpConfirm} onSendChat={handleSendChat} />;
  }
  if (room.phase === 'play') {
    return <TrickPlayView room={room} me={me} yourHand={yourHand} onPlay={handleCardPlay} onSendChat={handleSendChat} />;
  }
  // 'end' phase = Plan 4
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <div className="text-gold-500 text-5xl font-serif">♛</div>
      <div className="text-2xl font-bold">Phase: <span className="text-gold-500">{room.phase}</span></div>
      <div className="text-xs text-neutral-500 mt-2">(Plan 4 will build the results screen.)</div>
    </main>
  );
}
```

- [ ] **Step 2: Smoke test in browser (manually)**

Run `npm run dev`. Visit `http://localhost:3000` in 4 tabs. Create a room, join from the others, click Start. Bid. Pass. Once 3 pass, the bidder's tab should show the trump+partner modal. Confirm. Then play 13 cards across all 4 tabs. After the 13th trick, the page transitions to the "Phase: end" placeholder.

Kill dev server.

- [ ] **Step 3: TS + lint clean; commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/room/
git commit -m "Wire trump_partner + play phases into /room/[code]"
```

---

## Task 13: Playwright E2E for trump_partner + play

**Files:**
- Create: `tests/e2e/play.spec.ts`

- [ ] **Step 1: Write the E2E**

Create `tests/e2e/play.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

async function fourPlayerInBidding(browser: any) {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((c: any) => c.newPage()));
  const [host, g1, g2, g3] = pages;
  await host.goto('/');
  await host.getByPlaceholder('e.g. Dev').fill('Dev');
  await host.getByRole('button', { name: /Create a new room/i }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z]{4}/);
  const roomUrl = host.url();
  for (const [page, name] of [[g1, 'Sam'], [g2, 'Riya'], [g3, 'Aman']] as const) {
    await page.goto(roomUrl);
    await page.getByPlaceholder('Pick something fun').fill(name);
    await page.getByRole('button', { name: /Join room/i }).click();
  }
  await host.getByRole('button', { name: /^Start Game$/ }).click();
  for (const page of pages) {
    await expect(page.getByText(/Bidding phase/i)).toBeVisible();
  }
  return { contexts, pages, host, g1, g2, g3 };
}

test('bidder picks trump+partner; phase advances to play and all players see it', async ({ browser }) => {
  const { contexts, pages, host, g1, g2, g3 } = await fourPlayerInBidding(browser);

  // Host bids 75, others pass.
  await host.getByRole('button', { name: '75', exact: true }).first().click();
  for (const page of [g1, g2, g3]) {
    await page.getByRole('button', { name: /Pass at 75|^Pass$/ }).first().click();
  }

  // Host sees the trump+partner modal.
  await expect(host.getByText(/You won the bid/i)).toBeVisible();

  // Pick spades trump. Pick the FIRST non-owned card visible — any rank button on any
  // row that isn't the dashed/disabled (owned) variant. Easiest: pick a hearts rank
  // that isn't owned. We don't know which; just click the first "rank button" that's
  // enabled in the Hearts row.
  await host.getByRole('button', { name: 'spades' }).click();

  // Find an enabled rank button. The disabled (owned) ones have border-dashed; the
  // enabled ones have bg-white. Click the first enabled rank.
  const enabledRanks = host.locator('button:has-text("A"):not([disabled])').first();
  await enabledRanks.click();
  await host.getByRole('button', { name: /Lock it in/i }).click();

  // All clients now in 'play' phase.
  for (const page of pages) {
    // The InfoBadges show "Trump ♠".
    await expect(page.getByText(/Trump/i)).toBeVisible();
    await expect(page.getByText(/Bid 75/i)).toBeVisible();
  }

  await Promise.all(contexts.map((c: any) => c.close()));
});
```

This E2E is intentionally narrow (just verifies the trump_partner → play transition). Full 13-trick simulation would be brittle without knowing which cards are dealt.

- [ ] **Step 2: Run E2E**

Run `npm run test:e2e`
Expected: 7 tests pass (3 lobby + 3 bidding + 1 new).

If the "enabled rank" selector doesn't match cleanly, adjust the test to pick from a specific suit using a more deterministic selector. Don't change the page code.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/play.spec.ts
git commit -m "Add Playwright E2E for trump_partner → play transition"
```

---

## Task 14: Final smoke

- [ ] **Step 1: Full verification**

Run: `npm run lint && npm test && npm run test:e2e`
Expected: lint clean, ~86 unit tests pass, 7 E2E tests pass.

- [ ] **Step 2: If everything passes, you're done.** No commit needed.

---

## Done criteria for Plan 3

- [ ] After bidding completes, the bidder sees a modal with 4 suit buttons + a 4×13 card grid (their own cards dashed/disabled).
- [ ] Other players see a "Bidder is choosing…" wait screen.
- [ ] Bidder picks trump suit + a non-owned card and clicks "Lock it in".
- [ ] Phase transitions to `play`; all clients see the trick-play view with opponents' fanned card backs, your arced hand at the bottom, info badges top-left.
- [ ] On your turn, illegal cards are dimmed (must follow led suit).
- [ ] Click a card to stage it, click again (or click the "Click again to play" pill) to play.
- [ ] The trick completes after 4 plays; the winner leads the next trick.
- [ ] When the partner card is played, the partner name appears in the InfoBadges "Called" row.
- [ ] After 13 tricks, phase advances to `end` (placeholder).
- [ ] `npm test` ~86 pass; `npm run test:e2e` 7 pass; lint clean.

---

## Carried forward to Plan 4 / 5

- **End-of-game results screen** (verdicts, point totals, team reveal) — Plan 4.
- **Last-trick history** — the spec says the previous completed trick should be reviewable until the next one starts. Not implemented in Plan 3; cheap follow-up (a small floating panel or modal showing `completedTricks.at(-1)`).
- **Trump card highlighting in your hand** — Plan 3 doesn't add the gold ring around trump cards. Easy polish on top of `PlayerHand`.
- **Card play animation** — Plan 3 plays cards instantly. A short transit animation from your hand to the center could land later.
- **NOT_IN_HAND / MUST_FOLLOW_SUIT error toasts** — currently only console.warn. UX polish.
- **Direct unit tests for `chooseTrumpPartnerInRoom` and `playCardInRoom`** — currently covered only via socket E2E; consider adding direct tests in a follow-up.
- **`broadcastHands` after `card:play` re-broadcasts ALL hands** even though only one changed. Optimize once it matters.
