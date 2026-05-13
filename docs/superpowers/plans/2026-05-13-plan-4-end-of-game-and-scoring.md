# Black Queen — Plan 4: End-of-Game + Scoring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** When the 13th trick completes, the server advances phase to `end`. All 4 clients then see a results screen with the bidder + partner team grouping, total points captured per team, the win/loss verdict, captured point-card chips per team, and a host-only "Play again — same seats" button. Clicking "Play again" reshuffles, deals fresh hands, and returns the room to `bidding` (Plan 2 phase) with the same 4 players in the same seats.

**Architecture:** Scoring is a small pure function: `computeResults(publicGame)` walks `completedTricks`, sums point values into the winning seat, and groups seats into teams using `bid.currentBidderSeat` + `revealedPartnerSeat`. The function lives in `src/shared/results.ts` so the client (results screen) and any future server-side logging share it. A new `playAgainInRoom` action resets the game (clears `game`, `hands`, sets `phase: 'lobby'`) — the host can then click Start to deal a fresh hand. The page router gains an `EndView` branch.

**Tech Stack:** Unchanged.

**Out of scope (Plan 5):** disconnect/reconnect with hand recovery.

---

## File map

```
src/
├── shared/
│   ├── types.ts                  # MODIFY: room:play-again event + PlayAgainAck
│   └── results.ts                # NEW: pure computeResults helper
├── server/
│   ├── rooms.ts                  # MODIFY: playAgainInRoom + ensure partnerSeat revealed at end
│   └── socket.ts                 # MODIFY: room:play-again handler
├── components/
│   ├── end/                      # NEW directory
│   │   ├── Verdict.tsx           # "YOU WON" / "YOU LOST" header
│   │   ├── TeamCard.tsx          # bidder/other team box with points + chips
│   │   └── ChipRow.tsx           # one captured-point chip
│   └── views/
│       └── EndView.tsx           # NEW: composes results screen
├── app/
│   └── room/[code]/page.tsx      # MODIFY: 'end' phase branch
└── tests/
    ├── unit/
    │   └── results.test.ts       # NEW
    └── e2e/
        └── full-game.spec.ts     # NEW: drives all 13 tricks
```

---

## Task 1: computeResults helper + tests

**Files:**
- Create: `src/shared/results.ts`
- Create: `tests/unit/results.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/results.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeResults } from '@/shared/results';
import type { PublicGameState, Card, Suit } from '@/shared/types';

const c = (suit: Suit, rank: any): Card => ({ suit, rank });

function makeGame(partial: Partial<PublicGameState['bid']> & { trumpPartner: any; revealedPartnerSeat: any; completedTricks: any[] }): PublicGameState {
  return {
    bid: {
      currentBid: 95,
      currentBidderSeat: 1,
      passedSeats: [2, 3, 4],
      complete: true,
      ...partial,
    },
    trumpPartner: partial.trumpPartner,
    currentTrick: null,
    completedTricks: partial.completedTricks,
    revealedPartnerSeat: partial.revealedPartnerSeat,
  };
}

describe('computeResults', () => {
  it('returns null when game is incomplete', () => {
    const game = makeGame({
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: null,
      completedTricks: [],
    });
    expect(computeResults(game)).toBeNull();
  });

  it('returns null when trumpPartner is missing', () => {
    const game: PublicGameState = {
      bid: { currentBid: null, currentBidderSeat: null, passedSeats: [], complete: false },
      trumpPartner: null,
      currentTrick: null,
      completedTricks: [],
      revealedPartnerSeat: null,
    };
    expect(computeResults(game)).toBeNull();
  });

  it('sums point cards into the winning seat per trick', () => {
    const game = makeGame({
      currentBid: 100,
      currentBidderSeat: 1,
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: 2,
      completedTricks: [
        // Trick 1: Ace of hearts (15) + Q of spades (30) captured by seat 2
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('hearts', 'K') },     // 0
          { seat: 2, card: c('spades', '2') },     // trump, 0
          { seat: 3, card: c('hearts', 'A') },     // 15
          { seat: 4, card: c('spades', 'Q') },     // QoS, 30
        ], winnerSeat: 4 }, // seat 4 wins (Q spades > 2 spades)
      ],
    });
    const r = computeResults(game);
    expect(r).not.toBeNull();
    if (!r) return;
    // Seat 4 captured Ace of hearts (15) + QoS (30) + K hearts (0) + 2 spades (0) = 45
    expect(r.pointsBySeat[4]).toBe(45);
    expect(r.pointsBySeat[1]).toBe(0);
    expect(r.pointsBySeat[2]).toBe(0);
    expect(r.pointsBySeat[3]).toBe(0);
  });

  it('groups bidder + partner into bidder team, sums totals', () => {
    const game = makeGame({
      currentBid: 100,
      currentBidderSeat: 1,
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: 3,
      completedTricks: [
        // Seat 1 wins 15 points
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('hearts', 'A') },
          { seat: 2, card: c('hearts', '2') },
          { seat: 3, card: c('hearts', '3') },
          { seat: 4, card: c('hearts', '4') },
        ], winnerSeat: 1 },
        // Seat 3 (partner) wins 10 points
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('clubs', '2') },
          { seat: 2, card: c('clubs', '3') },
          { seat: 3, card: c('clubs', '10') },
          { seat: 4, card: c('clubs', '4') },
        ], winnerSeat: 3 },
        // Seat 2 (other) wins 5 points
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('diamonds', '2') },
          { seat: 2, card: c('diamonds', '5') },
          { seat: 3, card: c('diamonds', '3') },
          { seat: 4, card: c('diamonds', '4') },
        ], winnerSeat: 2 },
      ],
    });
    const r = computeResults(game);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.bidderTeamPoints).toBe(25); // 15 + 10
    expect(r.otherTeamPoints).toBe(5);
    expect(r.bidderTeamWon).toBe(false); // 25 < 100
  });

  it('marks bidder team as won when total ≥ bid', () => {
    const game = makeGame({
      currentBid: 15,
      currentBidderSeat: 1,
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: 3,
      completedTricks: [
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('hearts', 'A') },
          { seat: 2, card: c('hearts', '2') },
          { seat: 3, card: c('hearts', '3') },
          { seat: 4, card: c('hearts', '4') },
        ], winnerSeat: 1 },
      ],
    });
    const r = computeResults(game);
    expect(r?.bidderTeamWon).toBe(true);
  });

  it('captures the played cards into capturedBySeat', () => {
    const game = makeGame({
      currentBid: 95,
      currentBidderSeat: 1,
      trumpPartner: { trump: 'spades', calledCard: c('hearts', 'A') },
      revealedPartnerSeat: 3,
      completedTricks: [
        { ledBy: 1, ledSuit: 'hearts', plays: [
          { seat: 1, card: c('hearts', 'A') },
          { seat: 2, card: c('hearts', '2') },
          { seat: 3, card: c('hearts', '3') },
          { seat: 4, card: c('hearts', '4') },
        ], winnerSeat: 1 },
      ],
    });
    const r = computeResults(game);
    expect(r?.capturedBySeat[1].map((card) => `${card.rank}${card.suit[0]}`)).toEqual(['Ah', '2h', '3h', '4h']);
    expect(r?.capturedBySeat[2]).toEqual([]);
  });
});
```

Run `npm test` → expect failures.

- [ ] **Step 2: Implement `computeResults`**

Create `src/shared/results.ts`:

```typescript
import type { PublicGameState, Card, Seat, Suit } from './types';
import { pointValue } from './types';

export interface ResultsData {
  bidderSeat: Seat;
  partnerSeat: Seat;
  bidAmount: number;
  trump: Suit;
  calledCard: Card;
  pointsBySeat: Record<Seat, number>;
  capturedBySeat: Record<Seat, Card[]>;
  bidderTeamPoints: number;
  otherTeamPoints: number;
  bidderTeamWon: boolean;
}

/**
 * Compute end-of-game results from a public game state.
 * Returns null if the game is not yet in a complete state.
 */
export function computeResults(game: PublicGameState): ResultsData | null {
  if (!game.trumpPartner) return null;
  if (game.bid.currentBidderSeat === null || game.bid.currentBid === null) return null;
  if (game.revealedPartnerSeat === null) return null;
  if (game.completedTricks.length !== 13) return null;

  const bidderSeat = game.bid.currentBidderSeat;
  const partnerSeat = game.revealedPartnerSeat;
  const bidAmount = game.bid.currentBid;
  const trump = game.trumpPartner.trump;
  const calledCard = game.trumpPartner.calledCard;

  const pointsBySeat: Record<Seat, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const capturedBySeat: Record<Seat, Card[]> = { 1: [], 2: [], 3: [], 4: [] };

  for (const trick of game.completedTricks) {
    for (const { card } of trick.plays) {
      capturedBySeat[trick.winnerSeat].push(card);
      pointsBySeat[trick.winnerSeat] += pointValue(card);
    }
  }

  const bidderTeamPoints = pointsBySeat[bidderSeat] + pointsBySeat[partnerSeat];
  const otherSeats = ([1, 2, 3, 4] as Seat[]).filter((s) => s !== bidderSeat && s !== partnerSeat);
  const otherTeamPoints = otherSeats.reduce((sum, s) => sum + pointsBySeat[s], 0);
  const bidderTeamWon = bidderTeamPoints >= bidAmount;

  return {
    bidderSeat,
    partnerSeat,
    bidAmount,
    trump,
    calledCard,
    pointsBySeat,
    capturedBySeat,
    bidderTeamPoints,
    otherTeamPoints,
    bidderTeamWon,
  };
}
```

Run `npm test` → all pass.

- [ ] **Step 3: Commit**

```bash
git add src/shared/results.ts tests/unit/results.test.ts
git commit -m "Add computeResults: pure scoring from completedTricks"
```

(No `Co-Authored-By`.)

---

## Task 2: Room manager — playAgainInRoom + ensure partner revealed at end

**Files:**
- Modify: `src/server/rooms.ts`

- [ ] **Step 1: Update playCardInRoom to ensure partnerSeat is also publicly revealed at the moment the 13th trick completes**

In `playCardInRoom`, find the block that advances phase to `'end'` after 13 completed tricks. Just before setting `room.phase = 'end'`, ensure `room.game.revealedPartnerSeat` is set:

```typescript
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
```

- [ ] **Step 2: Add `playAgainInRoom`**

Append to `src/server/rooms.ts`:

```typescript
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
    id: crypto.randomUUID(),
    authorId: null,
    authorName: null,
    text: 'New game starting…',
    ts: Date.now(),
  });

  return { ok: true, room };
}
```

Note: `crypto.randomUUID()` — make sure `randomUUID` is imported from `node:crypto` at the top of the file. Inspect existing imports; if `randomUUID` is already there, use it directly without the `crypto.` prefix.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all clean, tests still 88+ pass (no behavior change to existing tests; `playAgainInRoom` and the partner-reveal defensive set are new).

- [ ] **Step 4: Commit**

```bash
git add src/server/rooms.ts
git commit -m "Add playAgainInRoom; ensure revealedPartnerSeat set when phase advances to end"
```

(No `Co-Authored-By`.)

---

## Task 3: Shared types — room:play-again event

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add the event**

In `src/shared/types.ts`, add to `ClientToServerEvents`:

```typescript
  'room:play-again': (cb: (res: PlayAgainAck) => void) => void;
```

And add the wire ack type near the other Ack types:

```typescript
export type PlayAgainAck =
  | { ok: true }
  | { ok: false; error: 'NOT_HOST' | 'NOT_IN_END' | 'NOT_IN_ROOM' };
```

- [ ] **Step 2: Verify TS + lint clean**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "Add room:play-again wire event and ack"
```

---

## Task 4: Socket handler — room:play-again

**Files:**
- Modify: `src/server/socket.ts`
- Modify: `tests/unit/socket.test.ts`

- [ ] **Step 1: Add failing test**

Append to `tests/unit/socket.test.ts`:

```typescript
describe('socket: room:play-again', () => {
  it('rejects non-host with NOT_HOST', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));
    const [host, c2] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    await new Promise<void>((resolve) => c2.emit('room:join', { code, name: 'Sam' }, () => resolve()));

    const ack: any = await new Promise((resolve) => c2.emit('room:play-again', resolve));
    expect(ack.ok).toBe(false);
    expect(['NOT_HOST', 'NOT_IN_END']).toContain(ack.error);

    clients.forEach((c) => c.disconnect());
  });

  it('rejects when not in end phase', async () => {
    const c = makeClient();
    await new Promise<void>((r) => c.on('connect', () => r()));
    await new Promise((resolve) => c.emit('room:create', { name: 'Dev' }, resolve));
    const ack: any = await new Promise((resolve) => c.emit('room:play-again', resolve));
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('NOT_IN_END');
    c.disconnect();
  });
});
```

Run `npm test` → expect 2 new failures.

- [ ] **Step 2: Wire the handler**

In `src/server/socket.ts`, add `playAgainInRoom` to the rooms import. Add a new handler before `disconnect`:

```typescript
    socket.on('room:play-again', (cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) { cb({ ok: false, error: 'NOT_IN_ROOM' }); return; }
      const res = playAgainInRoom({ code: roomCode, sessionId });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      cb({ ok: true });
      broadcastState(io, res.room);
    });
```

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: 90 unit tests pass (88 + 2 new).

- [ ] **Step 4: Commit**

```bash
git add src/server/socket.ts tests/unit/socket.test.ts
git commit -m "Wire room:play-again socket event"
```

---

## Task 5: End-screen visual components

**Files:**
- Create: `src/components/end/ChipRow.tsx`
- Create: `src/components/end/TeamCard.tsx`
- Create: `src/components/end/Verdict.tsx`

- [ ] **Step 1: ChipRow**

Create `src/components/end/ChipRow.tsx`:

```tsx
import type { Card, Suit } from '@/shared/types';
import { pointValue } from '@/shared/types';

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

interface Props {
  cards: Card[];
}

/** Renders one chip per point-card (5/10/A/Q♠); 0-point cards are omitted. */
export function ChipRow({ cards }: Props) {
  const points = cards.filter((c) => pointValue(c) > 0);
  if (points.length === 0) return <div className="text-[10px] text-neutral-500 italic">no point cards</div>;

  return (
    <div className="flex flex-wrap gap-1">
      {points.map((card, i) => {
        const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
        const isQoS = card.suit === 'spades' && card.rank === 'Q';
        const pts = pointValue(card);
        return (
          <span
            key={i}
            className={isQoS
              ? 'inline-flex items-center bg-amber-100 text-black text-[11px] font-bold font-serif px-1.5 py-0.5 rounded border border-amber-400 gap-1'
              : `inline-flex items-center bg-white text-[11px] font-bold font-serif px-1.5 py-0.5 rounded gap-1 ${isRed ? 'text-cardred' : 'text-cardblack'}`}
          >
            {card.rank}{SUIT_GLYPH[card.suit]}
            <span className="bg-gold-500/30 text-[9px] px-1 rounded text-amber-900 font-sans">+{pts}</span>
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TeamCard**

Create `src/components/end/TeamCard.tsx`:

```tsx
import type { Card, Seat } from '@/shared/types';
import { ChipRow } from './ChipRow';

interface Props {
  title: string;
  won: boolean;
  points: number;
  totalNeeded?: number; // for bidder team: show "/ needed N"
  members: Array<{ seat: Seat; name: string; role: 'bidder' | 'partner' | 'opponent'; isYou: boolean }>;
  capturedCards: Card[];
}

const ROLE_LABEL: Record<Props['members'][number]['role'], string> = {
  bidder: 'bidder',
  partner: 'partner',
  opponent: 'opponent',
};

const ROLE_COLOR: Record<Props['members'][number]['role'], string> = {
  bidder: 'text-gold-500',
  partner: 'text-pink-300',
  opponent: 'text-neutral-400',
};

export function TeamCard({ title, won, points, totalNeeded, members, capturedCards }: Props) {
  return (
    <div
      className={won
        ? 'bg-gold-500/10 border-2 border-gold-500 rounded-2xl p-4 shadow-xl shadow-gold-500/10'
        : 'bg-black/40 border-2 border-white/20 rounded-2xl p-4 opacity-80'}
    >
      <div className="flex justify-between items-baseline mb-2 pb-2 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">
          {title} · <b className={won ? 'text-gold-500' : 'text-white'}>{won ? 'Won' : 'Lost'}</b>
        </div>
        <div className={won ? 'text-2xl font-bold text-gold-500' : 'text-2xl font-bold text-white/70'}>
          {points}
          {totalNeeded !== undefined && (
            <span className="text-[11px] text-neutral-400 font-normal ml-1">/ needed {totalNeeded}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        {members.map((m) => (
          <div
            key={m.seat}
            className={m.isYou
              ? 'flex-1 bg-gold-500/15 border border-gold-500 rounded-lg p-2 text-center'
              : 'flex-1 bg-black/30 border border-white/10 rounded-lg p-2 text-center'}
          >
            <div className="text-sm font-semibold">{m.name}{m.isYou && ' (you)'}</div>
            <div className={`text-[9px] uppercase mt-0.5 ${ROLE_COLOR[m.role]}`}>{ROLE_LABEL[m.role]}</div>
          </div>
        ))}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-neutral-500 mb-1.5">Captured point cards</div>
      <ChipRow cards={capturedCards} />
    </div>
  );
}
```

- [ ] **Step 3: Verdict**

Create `src/components/end/Verdict.tsx`:

```tsx
interface Props {
  youWon: boolean;
  /** "Bidder team needed X · captured Y · bid {made|failed}" */
  summary: string;
}

export function Verdict({ youWon, summary }: Props) {
  return (
    <div className="text-center mb-4">
      <div
        className={youWon
          ? 'text-4xl font-extrabold text-gold-500 tracking-wider'
          : 'text-4xl font-extrabold text-neutral-400 tracking-wider'}
        style={youWon ? { textShadow: '0 0 24px rgba(244,200,66,0.4)' } : undefined}
      >
        {youWon ? 'YOU WON' : 'YOU LOST'}
      </div>
      <div className="text-xs text-neutral-300 mt-2">{summary}</div>
    </div>
  );
}
```

- [ ] **Step 4: Verify + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/end/
git commit -m "Add end-screen components: Verdict, TeamCard, ChipRow"
```

(No `Co-Authored-By`.)

---

## Task 6: EndView

**Files:**
- Create: `src/components/views/EndView.tsx`

- [ ] **Step 1: Implement**

Create `src/components/views/EndView.tsx`:

```tsx
'use client';
import type { RoomView, Player, Seat, Suit } from '@/shared/types';
import { computeResults } from '@/shared/results';
import { Verdict } from '@/components/end/Verdict';
import { TeamCard } from '@/components/end/TeamCard';
import { ChatPanel } from '@/components/ChatPanel';
import { seatNameFor } from '@/components/shared/seatNameFor';

interface Props {
  room: RoomView;
  me: Player;
  sessionId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
  onSendChat: (text: string) => void;
}

const SUIT_GLYPH: Record<Suit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

export function EndView({ room, me, sessionId, onPlayAgain, onLeave, onSendChat }: Props) {
  const results = room.game ? computeResults(room.game) : null;
  if (!results) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-3">
        <div className="text-gold-500 text-5xl font-serif">♛</div>
        <div className="text-lg text-neutral-300">Game complete — preparing results…</div>
      </main>
    );
  }

  const isHost = room.hostId === sessionId;
  const onBidderTeam = me.seat === results.bidderSeat || me.seat === results.partnerSeat;
  const youWon = onBidderTeam ? results.bidderTeamWon : !results.bidderTeamWon;

  const summary = results.bidderTeamWon
    ? `Bidder team needed ${results.bidAmount} · captured ${results.bidderTeamPoints} · bid made`
    : `Bidder team needed ${results.bidAmount} · captured only ${results.bidderTeamPoints} · bid failed`;

  const seatMember = (seat: Seat, role: 'bidder' | 'partner' | 'opponent') => ({
    seat,
    name: seatNameFor(room.players, seat),
    role,
    isYou: seat === me.seat,
  });

  const bidderTeam = [
    seatMember(results.bidderSeat, 'bidder'),
    seatMember(results.partnerSeat, 'partner'),
  ];
  const otherSeats = ([1, 2, 3, 4] as Seat[]).filter((s) => s !== results.bidderSeat && s !== results.partnerSeat);
  const otherTeam = otherSeats.map((s) => seatMember(s, 'opponent'));

  const bidderCaptured = [
    ...results.capturedBySeat[results.bidderSeat],
    ...results.capturedBySeat[results.partnerSeat],
  ];
  const otherCaptured = otherSeats.flatMap((s) => results.capturedBySeat[s]);

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <Verdict youWon={youWon} summary={summary} />

        <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-center text-xs text-neutral-300 mb-4">
          Trump was <span className="text-gold-500 font-bold">{SUIT_GLYPH[results.trump]}</span>
          {' · '}Bidder called{' '}
          <span className="text-pink-300 font-bold font-serif">{results.calledCard.rank}{SUIT_GLYPH[results.calledCard.suit]}</span>
          {' · '}Partner revealed: <b className="text-white">{seatNameFor(room.players, results.partnerSeat)}</b>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <TeamCard
            title="Bidder team"
            won={results.bidderTeamWon}
            points={results.bidderTeamPoints}
            totalNeeded={results.bidderTeamWon ? undefined : results.bidAmount}
            members={bidderTeam}
            capturedCards={bidderCaptured}
          />
          <TeamCard
            title="Other team"
            won={!results.bidderTeamWon}
            points={results.otherTeamPoints}
            members={otherTeam}
            capturedCards={otherCaptured}
          />
        </div>

        <div className="flex justify-center items-center gap-3">
          {isHost ? (
            <button
              type="button"
              onClick={onPlayAgain}
              className="bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-lg px-6 py-2.5 text-sm"
            >
              Play again — same seats
            </button>
          ) : (
            <div className="text-xs italic text-neutral-400">Waiting for {seatNameFor(room.players, room.players.find(p => p.id === room.hostId)?.seat ?? null)} (host) to start the next hand…</div>
          )}
          <button
            type="button"
            onClick={onLeave}
            className="border border-white/20 hover:border-red-400 hover:text-red-400 text-neutral-300 rounded-lg px-5 py-2.5 text-sm"
          >
            Leave room
          </button>
        </div>
      </div>

      <div className="fixed bottom-3 right-3"><ChatPanel messages={room.chat} onSend={onSendChat} /></div>
    </main>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/views/EndView.tsx
git commit -m "Add EndView composing results screen with team cards and play-again"
```

(No `Co-Authored-By`.)

---

## Task 7: Wire 'end' phase into page.tsx

**Files:**
- Modify: `src/app/room/[code]/page.tsx`

- [ ] **Step 1: Add the EndView branch + handlers**

In `src/app/room/[code]/page.tsx`:
1. Add `EndView` to imports.
2. Add `PlayAgainAck` to the type imports.
3. Add `handlePlayAgain` and `handleLeave` callbacks.
4. Add the `room.phase === 'end'` branch that renders `EndView`.

Here is the new `page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { selectMe, useGameStore } from '@/client/store';
import { JoinView } from '@/components/views/JoinView';
import { WaitingRoomView } from '@/components/views/WaitingRoomView';
import { BiddingView } from '@/components/views/BiddingView';
import { TrumpPartnerView } from '@/components/views/TrumpPartnerView';
import { TrickPlayView } from '@/components/views/TrickPlayView';
import { EndView } from '@/components/views/EndView';
import type {
  BidActionAck,
  JoinRoomResult,
  StartGameResult,
  TrumpPartnerActionAck,
  PlayCardAck,
  PlayAgainAck,
  Suit,
  Card,
} from '@/shared/types';

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
  const reset = useGameStore((s) => s.reset);
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
  const handleStart = () => socket.emit('room:start', (res: StartGameResult) => { if (!res.ok) console.warn('Start failed:', res.error); });
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
  const handlePlayAgain = () => {
    socket.emit('room:play-again', (res: PlayAgainAck) => {
      if (!res.ok) console.warn('Play again failed:', res.error);
    });
  };
  const handleLeave = () => {
    socket.emit('room:leave');
    reset();
    router.push('/');
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
  if (room.phase === 'end') {
    return <EndView room={room} me={me} sessionId={sessionId} onPlayAgain={handlePlayAgain} onLeave={handleLeave} onSendChat={handleSendChat} />;
  }
  return <main className="min-h-screen flex items-center justify-center text-neutral-500">Unknown phase: {room.phase}</main>;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean, 90 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/room/
git commit -m "Wire 'end' phase: render EndView; add play-again and leave handlers"
```

(No `Co-Authored-By`.)

---

## Task 8: E2E — full 13-trick game ending in results

**Files:**
- Create: `tests/e2e/full-game.spec.ts`

This test drives the entire game by clicking the first enabled card on each turn. Slow (52 clicks) but stable.

- [ ] **Step 1: Write the E2E**

Create `tests/e2e/full-game.spec.ts`:

```typescript
import { test, expect, type Page } from '@playwright/test';

/** Click the first enabled card in the player's hand. Returns true if clicked. */
async function playFirstLegalCard(page: Page): Promise<boolean> {
  // The hand cards are inside the PlayerHand component; legal cards have
  // .cursor-pointer (not .cursor-not-allowed). Illegal cards have opacity-30.
  // Stage: click first, then click again to play.
  const card = page.locator('main >> div.cursor-pointer:not(.opacity-30)').first();
  const count = await card.count();
  if (count === 0) return false;
  // Click twice to stage + play (the PlayerHand click handler stages on 1st click).
  await card.click();
  // Sometimes click-again on the same locator misses because the staged card has
  // a transform applied. Retry by re-querying — there's now a "Click again to play"
  // pill we can click instead:
  const pill = page.getByText(/Click again to play/i);
  await pill.click();
  return true;
}

test('drives 13 tricks to the end-of-game screen', async ({ browser }) => {
  test.setTimeout(180_000); // up to 3 minutes for 52 plays

  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [host, g1, g2, g3] = pages;

  // Setup
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

  // Bidding: host bids 75, others pass.
  await host.getByRole('button', { name: '75', exact: true }).first().click();
  for (const page of [g1, g2, g3]) {
    await page.getByRole('button', { name: /Pass at 75|^Pass$/ }).first().click();
  }

  // Trump-partner: host picks spades + first enabled rank.
  await expect(host.getByText(/You won the bid/i)).toBeVisible();
  await host.getByRole('button', { name: /spades/i }).click();
  await host.locator('button.bg-white:not([disabled])').first().click();
  await host.getByRole('button', { name: /Lock it in/i }).click();

  // Wait for play phase.
  for (const page of pages) {
    await expect(page.getByRole('button', { name: /Lock it in/i })).toHaveCount(0, { timeout: 5000 });
  }

  // Drive 13 tricks (52 plays). For each play, find the page showing "Your turn"
  // and have it click a card.
  for (let i = 0; i < 52; i++) {
    let played = false;
    for (const page of pages) {
      const yourTurn = await page.getByText(/Your turn/i).count();
      if (yourTurn > 0) {
        await playFirstLegalCard(page);
        played = true;
        break;
      }
    }
    if (!played) {
      // No one shows "Your turn" — phase has changed (likely advanced to end).
      break;
    }
    // Small settle between plays
    await pages[0].waitForTimeout(100);
  }

  // All clients should now be at the end screen.
  for (const page of pages) {
    await expect(page.getByText(/YOU WON|YOU LOST/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Bidder team needed/i)).toBeVisible();
  }

  // Host sees "Play again" button.
  await expect(host.getByRole('button', { name: /Play again — same seats/i })).toBeVisible();

  await Promise.all(contexts.map((c) => c.close()));
});
```

- [ ] **Step 2: Run E2E**

Run: `npm run test:e2e`
Expected: 8 tests pass (7 prior + 1 new full-game test).

If the new test is flaky or times out, debug with `await page.pause()` mid-flow. Common pitfalls:
- The "Click again to play" pill might not be visible if the staging state was missed; retry by clicking the card again.
- After the 13th play, the page transitions; the "Your turn" text disappears, breaking the loop — that's the exit condition.

If consistently flaky, consider increasing the wait or adding a `await page.waitForLoadState('networkidle')` between plays.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/full-game.spec.ts
git commit -m "Add Playwright E2E driving a full 13-trick game to end screen"
```

(No `Co-Authored-By`.)

---

## Task 9: Final smoke

- [ ] **Step 1: Full verification**

Run: `npm run lint && npm test && npm run test:e2e`
Expected: lint clean, 90 unit tests pass, 8 E2E tests pass.

- [ ] **Step 2: If everything passes, done.** No commit needed.

If the new E2E is unstable, mark it `.skip` for now and add to the carry-forward list.

---

## Done criteria for Plan 4

- [ ] When the 13th trick completes, all clients transition from `play` to `end`.
- [ ] EndView renders with: personalized "YOU WON"/"YOU LOST" verdict, summary line, reveal bar (trump, called card, partner name), two team cards with point totals and captured-point chips, host-only "Play again" button, everyone has "Leave room".
- [ ] Clicking "Play again" (host) resets the room to lobby; cards re-deal when host clicks Start.
- [ ] Clicking "Leave room" disconnects from the room and routes to landing.
- [ ] `npm test` ≥90 pass; `npm run test:e2e` 8 pass; lint clean.

---

## Carry-forward to Plan 5

- **Reconnect/replacement player** — Plan 5.
- **"Leave room" mid-game** — currently leaves silently; should the rest of the room see a system message? (chat already says "X left" via existing `leaveRoom`.)
- **Animation on result reveal** — currently the screen just appears. A 1-2 second pause + scale-in could feel better.
- **Trick history viewer** — see previous trick from any phase. Spec calls for this; Plan 3 carried it forward.
- **Direct unit tests for `playAgainInRoom`** — currently socket-tested only.
