# Black Queen — Plan 5: Disconnects + Reconnects

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Players can refresh the page or briefly lose their connection and resume their seat with hand intact. After a 60-second disconnect window, the seat becomes available for a replacement player — a new joiner with a different name can take the seat and inherit the hand. The original player attempting to resume an invalidated session is bounced to a "this room has been resumed without you" page.

**Architecture:** Two cooperating pieces:
1. **Session persistence**: client stores `{sessionId, roomCode}` in `localStorage` on every successful create/join/resume. On page load, if the URL is `/room/<CODE>` and storage has a session for that code, the client emits `session:resume({sessionId})` before showing any UI. Server validates and re-binds the socket to the existing player, marks them connected, and re-sends `hand:update`.
2. **Replacement flow**: each `Player` gains a `disconnectedAt: number | null` timestamp. The server considers a seat "replaceable" if `disconnectedAt < Date.now() - REPLACEMENT_WINDOW_MS` (60_000). `joinRoom` is widened: if the room is "full" but contains a replaceable seat, the new joiner takes that seat and inherits the disconnected player's hand. The original player's `id` (sessionId) is replaced; subsequent `session:resume` attempts with the old id fail with `REPLACED`.

**Tech Stack:** Unchanged.

**Spec section:** §7.3 (Disconnects & reconnects), §7.4 (Session identity).

---

## File map

```
src/
├── shared/
│   └── types.ts                       # MODIFY: Player.disconnectedAt; session:resume event; ResumeAck; REPLACED error
├── server/
│   ├── rooms.ts                       # MODIFY: setConnected, joinRoom (replacement-aware), resumeInRoom
│   └── socket.ts                      # MODIFY: session:resume handler; setConnected timestamp; broadcast on resume
├── client/
│   ├── store.ts                       # unchanged in core; reset clears localStorage
│   ├── session.ts                     # NEW: tiny localStorage wrapper {save, load, clear}
│   └── useSocket.ts                   # MODIFY: auto-resume on connect if storage has a session
├── components/
│   ├── views/
│   │   ├── JoinView.tsx               # MODIFY: store session on successful join
│   │   ├── BouncedView.tsx            # NEW: "this room has been resumed without you" screen
│   │   └── ResumingView.tsx           # NEW: brief loading screen while resume RPC is in-flight
│   └── Seat.tsx                       # MODIFY: show "Reconnecting…" / "Open for replacement" badges
├── app/
│   ├── page.tsx                       # MODIFY: store session on create-room success
│   └── room/[code]/page.tsx           # MODIFY: resume flow; bounce branch
└── tests/
    ├── unit/
    │   ├── rooms.test.ts              # MODIFY: tests for replacement + resume
    │   └── socket.test.ts             # MODIFY: integration tests for session:resume
    └── e2e/
        └── reconnect.spec.ts          # NEW
```

---

## Constants

In `src/shared/types.ts`, add:

```typescript
/** Window during which a disconnected player can resume their seat (ms). */
export const REPLACEMENT_WINDOW_MS = 60_000;
```

---

## Task 1: Shared types — disconnectedAt + session events

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add `disconnectedAt` to Player**

Modify the existing `Player` interface:

```typescript
export interface Player {
  id: string;
  name: string;
  seat: 1 | 2 | 3 | 4;
  connected: boolean;
  /** Epoch ms of most recent disconnect, or null if connected. */
  disconnectedAt: number | null;
}
```

- [ ] **Step 2: Add the constant + session events**

Add to `src/shared/types.ts`:

```typescript
export const REPLACEMENT_WINDOW_MS = 60_000;

/** Result returned by session:resume. */
export type ResumeAck =
  | { ok: true; sessionId: string; room: Room }
  | { ok: false; error: 'NOT_FOUND' | 'REPLACED' };
```

Extend `ClientToServerEvents`:

```typescript
  'session:resume': (
    payload: { sessionId: string; code: string },
    cb: (res: ResumeAck) => void
  ) => void;
```

- [ ] **Step 3: Verify**

Existing code constructs `Player` without `disconnectedAt`. Touch up `src/server/rooms.ts` `createRoom` and `joinRoom` to initialize `disconnectedAt: null` for each newly-created player.

Run `npx tsc --noEmit`. Fix any type errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/server/rooms.ts
git commit -m "Add disconnectedAt to Player; session:resume event and ResumeAck type"
```

(No `Co-Authored-By`.)

---

## Task 2: Room manager — setConnected timestamp, replacement-aware join, resumeInRoom

**Files:**
- Modify: `src/server/rooms.ts`
- Modify: `tests/unit/rooms.test.ts`

- [ ] **Step 1: Update `setConnected` to maintain `disconnectedAt`**

Replace the existing `setConnected`:

```typescript
export function setConnected(input: SetConnectedInput): void {
  const room = rooms.get(input.code);
  if (!room) return;
  const player = room.players.find((p) => p.id === input.sessionId);
  if (!player) return;
  player.connected = input.connected;
  if (input.connected) {
    player.disconnectedAt = null;
  } else if (player.disconnectedAt === null) {
    player.disconnectedAt = Date.now();
  }
}
```

- [ ] **Step 2: Add `resumeInRoom`**

Append to `src/server/rooms.ts`:

```typescript
type ResumeInRoomResult =
  | { ok: true; room: RoomServerState }
  | { ok: false; error: 'NOT_FOUND' | 'REPLACED' };

export function resumeInRoom(input: { code: string; sessionId: string }): ResumeInRoomResult {
  const room = rooms.get(input.code);
  if (!room) return { ok: false, error: 'NOT_FOUND' };
  const player = room.players.find((p) => p.id === input.sessionId);
  if (!player) return { ok: false, error: 'REPLACED' };
  player.connected = true;
  player.disconnectedAt = null;
  return { ok: true, room };
}
```

- [ ] **Step 3: Widen `joinRoom` to handle replacement**

Modify `joinRoom`. Replace the existing implementation with:

```typescript
export function joinRoom(input: JoinRoomInput): JoinRoomResult {
  const room = rooms.get(input.code);
  if (!room) return { ok: false, error: 'NOT_FOUND' };

  let name: string;
  try {
    name = validateName(input.name);
  } catch {
    return { ok: false, error: 'NAME_INVALID' };
  }

  // Replacement path: if room is full but a player is past the disconnect window,
  // the new joiner takes that seat.
  const now = Date.now();
  const replaceable = room.players.find(
    (p) => !p.connected && p.disconnectedAt !== null && now - p.disconnectedAt >= REPLACEMENT_WINDOW_MS,
  );
  if (room.players.length >= MAX_PLAYERS) {
    if (!replaceable) return { ok: false, error: 'FULL' };
    // Replace the disconnected player. New sessionId, new name; keep the seat.
    // The replacement inherits any hand the disconnected player held.
    if (room.players.some((p) => p !== replaceable && p.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: 'NAME_TAKEN' };
    }
    const newId = randomUUID();
    replaceable.id = newId;
    replaceable.name = name;
    replaceable.connected = true;
    replaceable.disconnectedAt = null;
    room.chat.push({
      id: randomUUID(),
      authorId: null,
      authorName: null,
      text: `${name} took an open seat`,
      ts: Date.now(),
    });
    return { ok: true, sessionId: newId, room: toRoomView(room) };
  }

  // Normal path (room not full)
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

  return { ok: true, sessionId: id, room: toRoomView(room) };
}
```

Note: `toRoomView` must be imported at the top of `rooms.ts` if not already (it should be from Plan 2 — confirm).

- [ ] **Step 4: Add tests**

Append to `tests/unit/rooms.test.ts`:

```typescript
import { resumeInRoom } from '@/server/rooms';
import { REPLACEMENT_WINDOW_MS } from '@/shared/types';

describe('resumeInRoom', () => {
  it('re-binds a disconnected player by sessionId', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    setConnected({ code: room.code, sessionId, connected: false });
    expect(getRoom(room.code)?.players[0].connected).toBe(false);

    const r = resumeInRoom({ code: room.code, sessionId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.room.players[0].connected).toBe(true);
    expect(r.room.players[0].disconnectedAt).toBeNull();
  });

  it('returns NOT_FOUND for unknown room', () => {
    const r = resumeInRoom({ code: 'ZZZZ', sessionId: 'x' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('NOT_FOUND');
  });

  it('returns REPLACED if sessionId not found in the (existing) room', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const r = resumeInRoom({ code: room.code, sessionId: 'fake' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('REPLACED');
  });
});

describe('joinRoom — replacement', () => {
  it('a new joiner replaces a disconnected player past the window', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    const aman = joinRoom({ code: room.code, name: 'Aman' });
    if (!aman.ok) throw new Error('precondition');

    setConnected({ code: room.code, sessionId: aman.sessionId, connected: false });
    // Force timestamp into the past
    const live = getRoom(room.code);
    if (!live) throw new Error('precondition');
    const target = live.players.find((p) => p.id === aman.sessionId);
    if (!target) throw new Error('precondition');
    target.disconnectedAt = Date.now() - REPLACEMENT_WINDOW_MS - 1;

    const sub = joinRoom({ code: room.code, name: 'Substitute' });
    expect(sub.ok).toBe(true);
    if (!sub.ok) return;
    expect(sub.room.players).toHaveLength(4);
    const seat4 = sub.room.players.find((p) => p.seat === 4);
    expect(seat4?.name).toBe('Substitute');
    expect(seat4?.id).toBe(sub.sessionId);
    // The OLD sessionId is gone:
    const old = resumeInRoom({ code: room.code, sessionId: aman.sessionId });
    expect(old.ok).toBe(false);
  });

  it('does NOT allow replacement when within the window', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    const aman = joinRoom({ code: room.code, name: 'Aman' });
    if (!aman.ok) throw new Error('precondition');

    setConnected({ code: room.code, sessionId: aman.sessionId, connected: false });
    // Recent disconnect (well within the window)
    const sub = joinRoom({ code: room.code, name: 'Substitute' });
    expect(sub.ok).toBe(false);
    if (sub.ok) return;
    expect(sub.error).toBe('FULL');
  });
});
```

Run `npm test` → expect failures, then implementation, then pass.

- [ ] **Step 5: Verify TS + lint + commit**

```bash
npx tsc --noEmit && npm run lint && npm test
git add src/server/rooms.ts tests/unit/rooms.test.ts
git commit -m "Add resumeInRoom and replacement-aware joinRoom; setConnected tracks disconnectedAt"
```

---

## Task 3: Socket handler — session:resume

**Files:**
- Modify: `src/server/socket.ts`
- Modify: `tests/unit/socket.test.ts`

- [ ] **Step 1: Add the handler**

In `src/server/socket.ts`, import `resumeInRoom` from `./rooms`. Add the handler before `disconnect`:

```typescript
    socket.on('session:resume', ({ sessionId, code }, cb) => {
      const res = resumeInRoom({ code, sessionId });
      if (!res.ok) { cb({ ok: false, error: res.error }); return; }
      // Bind this socket to the resumed session
      socket.data.sessionId = sessionId;
      socket.data.roomCode = code;
      socket.join(roomChannel(code));
      cb({ ok: true, sessionId, room: toRoomView(res.room) });
      // Re-emit the player's hand if game is in progress
      if (res.room.hands) {
        const player = res.room.players.find((p) => p.id === sessionId);
        if (player) {
          socket.emit('hand:update', { hand: res.room.hands[player.seat] });
        }
      }
      // Broadcast room state so other clients see the reconnect
      broadcastState(io, res.room);
    });
```

- [ ] **Step 2: Add integration tests**

Append to `tests/unit/socket.test.ts`:

```typescript
describe('socket: session:resume', () => {
  it('resumes a disconnected client; ack returns room + hand:update is re-emitted', async () => {
    const host = makeClient();
    await new Promise<void>((r) => host.on('connect', () => r()));
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const sessionId = created.sessionId;
    const code = created.room.code;
    host.disconnect();

    // wait a tick to ensure server registers the disconnect
    await new Promise((r) => setTimeout(r, 50));

    const reconnect = makeClient();
    await new Promise<void>((r) => reconnect.on('connect', () => r()));
    const ack: any = await new Promise((resolve) => reconnect.emit('session:resume', { sessionId, code }, resolve));
    expect(ack.ok).toBe(true);
    expect(ack.sessionId).toBe(sessionId);
    expect(ack.room.players[0].connected).toBe(true);

    reconnect.disconnect();
  });

  it('returns REPLACED for unknown sessionId', async () => {
    const c = makeClient();
    await new Promise<void>((r) => c.on('connect', () => r()));
    const created: any = await new Promise((resolve) => c.emit('room:create', { name: 'Dev' }, resolve));

    const c2 = makeClient();
    await new Promise<void>((r) => c2.on('connect', () => r()));
    const ack: any = await new Promise((resolve) => c2.emit('session:resume', { sessionId: 'fake', code: created.room.code }, resolve));
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('REPLACED');

    c.disconnect();
    c2.disconnect();
  });
});
```

Run `npm test`. Both tests should pass.

- [ ] **Step 3: Commit**

```bash
git add src/server/socket.ts tests/unit/socket.test.ts
git commit -m "Wire session:resume socket event with hand re-emission and state broadcast"
```

---

## Task 4: Client — session persistence + auto-resume

**Files:**
- Create: `src/client/session.ts`
- Modify: `src/client/useSocket.ts`

- [ ] **Step 1: localStorage helper**

Create `src/client/session.ts`:

```typescript
'use client';

const KEY = 'black-queen-session';

export interface StoredSession {
  sessionId: string;
  code: string;
}

export function saveSession(session: StoredSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* noop */
  }
}

export function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.sessionId === 'string' && typeof parsed?.code === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
```

- [ ] **Step 2: Auto-resume in `useSocket`**

Modify `src/client/useSocket.ts`. Add an effect that, on socket connect, checks `loadSession()`, compares to the current URL (which should contain `/room/<CODE>`), and if both match, emits `session:resume`.

Replace `useSocket.ts` body with this version:

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, Card, RoomView, ResumeAck } from '@/shared/types';
import { useGameStore } from './store';
import { loadSession, saveSession, clearSession } from './session';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let singletonSocket: ClientSocket | null = null;

export function useSocket(): ClientSocket {
  const ref = useRef<ClientSocket | null>(singletonSocket);
  const setConnected = useGameStore((s) => s.setConnected);
  const setRoom = useGameStore((s) => s.setRoom);
  const setHand = useGameStore((s) => s.setHand);
  const setSession = useGameStore((s) => s.setSession);

  if (!ref.current) {
    singletonSocket = io({ transports: ['websocket'] });
    ref.current = singletonSocket;
  }

  useEffect(() => {
    const socket = ref.current!;

    function tryAutoResume() {
      const stored = loadSession();
      if (!stored) return;
      // Only resume if we're on /room/<CODE> matching the stored code.
      if (typeof window === 'undefined') return;
      const m = window.location.pathname.match(/\/room\/([A-Z]{4})/i);
      if (!m || m[1].toUpperCase() !== stored.code.toUpperCase()) return;

      socket.emit('session:resume', { sessionId: stored.sessionId, code: stored.code }, (res: ResumeAck) => {
        if (res.ok) {
          saveSession({ sessionId: res.sessionId, code: stored.code });
          setSession(res.sessionId);
          setRoom(res.room);
        } else {
          clearSession();
          if (res.error === 'REPLACED' && typeof window !== 'undefined') {
            window.location.replace('/bounced');
          }
        }
      });
    }

    const onConnect = () => { setConnected(true); tryAutoResume(); };
    const onDisconnect = () => setConnected(false);
    const onRoomState = (room: RoomView) => setRoom(room);
    const onHandUpdate = (payload: { hand: Card[] }) => setHand(payload.hand);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('hand:update', onHandUpdate);

    if (socket.connected) { setConnected(true); tryAutoResume(); }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('hand:update', onHandUpdate);
    };
  }, [setConnected, setRoom, setHand, setSession]);

  return ref.current!;
}
```

- [ ] **Step 3: Save session on create + join**

Modify `src/app/page.tsx`: after a successful `room:create`, call `saveSession({ sessionId: res.sessionId, code: res.room.code })`.

Modify `src/components/views/JoinView.tsx`: after a successful join, the parent (`page.tsx`) is the one that has the session info, so it's cleaner to save in the page. Modify `src/app/room/[code]/page.tsx`'s `handleJoin`: after `setSession(res.sessionId); setRoom(res.room);`, call `saveSession({ sessionId: res.sessionId, code: room.code })` (note `room.code` here is the URL param's `code`).

Modify `src/app/room/[code]/page.tsx`'s `handleLeave` to call `clearSession()` before navigation.

- [ ] **Step 4: Verify + commit**

```bash
npx tsc --noEmit && npm run lint && npm test
git add src/client/ src/app/page.tsx src/app/room/
git commit -m "Add localStorage session persistence and auto-resume on socket connect"
```

(No `Co-Authored-By`.)

---

## Task 5: Bounce + Resuming views

**Files:**
- Create: `src/components/views/BouncedView.tsx`
- Create: `src/app/bounced/page.tsx`

- [ ] **Step 1: BouncedView**

Create `src/components/views/BouncedView.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';

export function BouncedView() {
  const router = useRouter();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-gold-500 text-5xl font-serif">♛</div>
      <div className="text-xl font-bold">This room resumed without you</div>
      <div className="text-sm text-neutral-400 max-w-md text-center">
        You were disconnected for more than 60 seconds and another player took your seat. You can return to the
        landing page and create or join a new room.
      </div>
      <button
        type="button"
        onClick={() => router.push('/')}
        className="bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-lg px-5 py-2 text-sm"
      >
        Back to landing
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Bounced page route**

Create `src/app/bounced/page.tsx`:

```tsx
import { BouncedView } from '@/components/views/BouncedView';

export default function BouncedPage() {
  return <BouncedView />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/views/BouncedView.tsx src/app/bounced/
git commit -m "Add BouncedView and /bounced route for replaced sessions"
```

---

## Task 6: UI — Reconnecting / Open for replacement badges

**Files:**
- Modify: `src/components/Seat.tsx`

- [ ] **Step 1: Update Seat to show reconnect / replace badges**

Modify `src/components/Seat.tsx`. Replace the `{!empty && !player.connected && ...}` block with:

```tsx
{!empty && !player.connected && (() => {
  const since = player.disconnectedAt ?? Date.now();
  const replaceable = Date.now() - since >= 60_000;
  return replaceable
    ? <div className="mt-1 text-[10px] text-orange-300 italic">Open for replacement</div>
    : <div className="mt-1 text-[10px] text-amber-400 animate-pulse">Reconnecting…</div>;
})()}
```

Note: this evaluates `Date.now()` at render time, so the badge will only flip when the seat re-renders (which happens on any `room:state` broadcast). For a fresh-rendering page in the lobby with no other events, the user might see "Reconnecting…" stuck — that's acceptable for v1.

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/Seat.tsx
git commit -m "Show Reconnecting…/Open for replacement badges on Seat"
```

---

## Task 7: Page-level integration — handle resume in /room/[code]

**Files:**
- Modify: `src/app/room/[code]/page.tsx`

- [ ] **Step 1: Use the resume flow inside the page**

The auto-resume happens inside `useSocket` and writes to the store. The page just needs to:
- Save session on create-via-landing (already handled).
- Save session on direct-link join (already added in Task 4).
- Clear session on leave (already added in Task 4).
- Optionally show a "Resuming…" splash if a stored session exists but the room hasn't been populated yet. The existing `Loading…` fallback covers it.

No code change needed here beyond what Task 4 already did. Verify the flow by running the dev server and refreshing the room page — your seat should be restored.

- [ ] **Step 2: Smoke test in browser**

Run `npm run dev`. Open 4 browser tabs, create a room, join from 3 others, start the game, bid 75, advance to play. Refresh one of the tabs (the one in `play` phase). The page should reload, briefly show "Loading…", then return you to the play view with your hand intact.

Kill dev server.

- [ ] **Step 3: No commit (verification only).**

---

## Task 8: E2E — refresh during lobby preserves session

**Files:**
- Create: `tests/e2e/reconnect.spec.ts`

The trickiest part: Playwright's localStorage persists per browser context. We exploit that.

- [ ] **Step 1: Write the test**

Create `tests/e2e/reconnect.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('refreshing the room page preserves your seat (lobby phase)', async ({ browser }) => {
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();

  // Host creates a room
  await p1.goto('/');
  await p1.getByPlaceholder('e.g. Dev').fill('Dev');
  await p1.getByRole('button', { name: /Create a new room/i }).click();
  await expect(p1).toHaveURL(/\/room\/[A-Z]{4}/);
  const roomUrl = p1.url();

  // Guest joins
  await p2.goto(roomUrl);
  await p2.getByPlaceholder('Pick something fun').fill('Sam');
  await p2.getByRole('button', { name: /Join room/i }).click();
  await expect(p2.getByText('Sam').first()).toBeVisible();

  // Refresh the host's tab
  await p1.reload();

  // After reload, host's seat should still be present (the auto-resume happens).
  // The waiting room renders with "Room <CODE>" header and Dev/Sam visible.
  await expect(p1.getByText('Dev').first()).toBeVisible({ timeout: 8000 });
  await expect(p1.getByText('Sam').first()).toBeVisible();
  await expect(p1.getByText(/★ host/i)).toBeVisible();

  await Promise.all([c1.close(), c2.close()]);
});

test('clearing localStorage and revisiting shows the join form again', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/');
  await page.getByPlaceholder('e.g. Dev').fill('Dev');
  await page.getByRole('button', { name: /Create a new room/i }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z]{4}/);
  const roomUrl = page.url();

  // Clear localStorage to simulate a "different browser" returning to the URL.
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(roomUrl);

  // Should land on the join form again ("You've been invited to room").
  await expect(page.getByText(/You(’|')ve been invited/i)).toBeVisible();

  await ctx.close();
});
```

- [ ] **Step 2: Run E2E**

Run `npm run test:e2e`.
Expected: 10 tests pass (8 prior + 2 new).

If the resume test is flaky, increase the timeout on the first assertion. Avoid `waitForTimeout` if possible.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/reconnect.spec.ts
git commit -m "Add E2E for session resume and bounce on cleared session"
```

---

## Task 9: Final smoke

- [ ] **Step 1: Full verification**

```bash
npm run lint && npm test && npm run test:e2e
```

Expected: lint clean, ≥99 unit tests pass (96 + ~3 rooms + ~2 socket = 101+), 10 E2E tests pass.

- [ ] **Step 2: If everything passes, done.**

---

## Done criteria for Plan 5

- [ ] Refreshing a tab in any phase auto-resumes the player's seat with hand intact.
- [ ] A disconnected player's seat shows "Reconnecting…" within 60s, then "Open for replacement".
- [ ] A new joiner with a unique name takes the open seat when room is "full" but past the window.
- [ ] The replaced original player's `session:resume` attempt is rejected with `REPLACED` and routes them to `/bounced`.
- [ ] Leaving via the "Leave room" button clears the session token.
- [ ] All unit + E2E tests pass.

---

## Carry-forward / nice-to-haves (no further planned plan)

- **Live countdown on "Reconnecting…"** — currently re-evaluated per re-render. A `setInterval`-driven badge would feel smoother.
- **Host can explicitly kick a stalled player** before the 60s window — currently no UI for this. Add later if it becomes a common need.
- **System chat on replacement** — message "Substitute took Aman's seat" already added; matches spec.
- **Auth/token hardening** — sessions are guessable UUIDs over a single-instance in-memory map; fine for hobby use, would need proper signed tokens before any public deploy.
- **Multi-tab same-session collision** — two tabs with the same `sessionId` will both bind to the same player; messages broadcast to both. Document as quirky behavior.
