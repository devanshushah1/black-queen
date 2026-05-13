# Black Queen — Plan 1: Scaffold + Lobby/Rooms

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user can open the app, create a room (gets a 4-letter code), share an invite link, friends join via the link, all 4 seats fill, and the host can click "Start Game" to navigate to a placeholder game page. No game logic, bidding, trump, or trick play yet — just the lobby and the multiplayer transport that everything else will build on.

**Architecture:** Next.js 14 (App Router) running under a custom `server.ts` that creates an HTTP server and attaches both Next.js and Socket.IO to it. All room state lives in an in-memory `rooms.ts` module on the server (a pure-function module that is easy to unit-test). Socket.IO handlers translate socket events into calls on the room manager and broadcast updated state to everyone in the room. The client uses Zustand for state, a `useSocket` hook to bridge the socket to the store, and Tailwind for styling. Hidden info (per-player hand, partner identity) doesn't exist yet but the architecture leaves room: room state is filtered per-recipient in the broadcast layer.

**Tech Stack:**
- **Runtime:** Node.js 20+, TypeScript 5
- **Framework:** Next.js 14 (App Router)
- **Real-time:** Socket.IO 4 (server + client)
- **Client state:** Zustand 4
- **Styling:** Tailwind CSS 3
- **Unit tests:** Vitest
- **E2E tests:** Playwright
- **Linting:** ESLint (Next.js preset) + Prettier
- **Server runner:** `tsx` (for running `server.ts` directly without a build step in dev)

**Out of scope for this plan:** dealing cards, bidding, trump/partner selection, trick play, scoring, end-of-game screen, disconnects/reconnects (those land in Plans 2-5).

---

## File map

```
black-queen/
├── package.json                       # Task 1
├── tsconfig.json                      # Task 1
├── next.config.mjs                    # Task 1
├── postcss.config.mjs                 # Task 1
├── tailwind.config.ts                 # Task 1
├── vitest.config.ts                   # Task 1
├── playwright.config.ts               # Task 1
├── .eslintrc.json                     # Task 1
├── .prettierrc                        # Task 1
├── server.ts                          # Task 2 (custom Next.js + Socket.IO server)
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Task 1
│   │   ├── globals.css                # Task 1
│   │   ├── page.tsx                   # Task 12 (landing)
│   │   ├── room/[code]/page.tsx       # Task 13 (waiting room)
│   │   └── game-starting/page.tsx     # Task 20 (placeholder)
│   ├── shared/
│   │   └── types.ts                   # Task 3
│   ├── server/
│   │   ├── rooms.ts                   # Tasks 4-7
│   │   └── socket.ts                  # Tasks 8-11
│   ├── client/
│   │   ├── store.ts                   # Task 12
│   │   └── useSocket.ts               # Task 12
│   └── components/
│       ├── Avatar.tsx                 # Task 14
│       ├── Seat.tsx                   # Task 15
│       ├── InviteCard.tsx             # Task 16
│       ├── StartCard.tsx              # Task 17
│       └── ChatPanel.tsx              # Task 18
└── tests/
    ├── unit/
    │   ├── rooms.test.ts              # Tasks 4-7
    │   └── socket.test.ts             # Tasks 8-11
    └── e2e/
        └── lobby.spec.ts              # Task 21
```

Why these boundaries:
- **`rooms.ts` is pure logic** (no I/O, no socket dependencies). Maximally testable. Returns new state from inputs; the socket layer translates that into emits.
- **`socket.ts` is the bridge.** It owns the Socket.IO instance and translates events ↔ room-manager calls.
- **`store.ts` and `useSocket.ts` are separate** so the store works with or without a socket (e.g., for Storybook or unit tests later).
- **Component files are small** (~50-120 lines each). Easier for an AI to edit reliably.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.eslintrc.json`
- Create: `.prettierrc`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx` (temporary "Hello" page; replaced in Task 12)
- Create: `src/app/globals.css`

- [ ] **Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "black-queen",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch server.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server.ts",
    "lint": "next lint",
    "format": "prettier --write \"**/*.{ts,tsx,css,md}\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "14.2.35",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "socket.io": "4.8.3",
    "socket.io-client": "4.8.3",
    "zustand": "4.5.4"
  },
  "devDependencies": {
    "@playwright/test": "1.60.0",
    "@types/node": "20.14.10",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "@vitejs/plugin-react": "4.3.1",
    "autoprefixer": "10.4.19",
    "eslint": "8.57.0",
    "eslint-config-next": "14.2.35",
    "postcss": "8.5.14",
    "prettier": "3.3.3",
    "tailwindcss": "3.4.6",
    "tsx": "4.16.2",
    "typescript": "5.5.3",
    "vitest": "1.6.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs into `node_modules/`, generates `package-lock.json`, no errors.

- [ ] **Step 3: Add tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Add Next.js + Tailwind + PostCSS configs**

Create `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default nextConfig;
```

Create `postcss.config.mjs`:

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

Create `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Game palette
        felt: { 900: '#073322', 800: '#115540', 700: '#1f6b50' },
        gold: { 400: '#ffd455', 500: '#f4c842', 600: '#d4a830' },
        cardred: '#c52a2a',
        cardblack: '#1d1d1f',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Add Vitest + Playwright + ESLint + Prettier configs**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

Create `.eslintrc.json`:

```json
{ "extends": "next/core-web-vitals" }
```

Create `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 6: Add Next.js App Router root files**

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body {
  height: 100%;
  background: #051f15;
  color: #f0f0f0;
  font-family: system-ui, -apple-system, sans-serif;
}
```

Create `src/app/layout.tsx`:

```tsx
import './globals.css';

export const metadata = {
  title: 'Black Queen',
  description: '4-player trick-taking card game',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx` (placeholder; replaced in Task 12):

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl">Scaffold OK · Black Queen</h1>
    </main>
  );
}
```

- [ ] **Step 7: Verify the scaffold compiles**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

Run: `npm run lint`
Expected: exits 0, no lint errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts vitest.config.ts playwright.config.ts .eslintrc.json .prettierrc src/app/
git commit -m "Scaffold Next.js + Tailwind + Vitest + Playwright"
```

---

## Task 2: Custom server (Next.js + Socket.IO)

**Files:**
- Create: `server.ts`

- [ ] **Step 1: Write `server.ts` that boots Next.js and Socket.IO on the same HTTP server**

Create `server.ts`:

```typescript
import { createServer } from 'node:http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: dev ? '*' : undefined },
  });

  // Real handlers wired in Task 8; for now log connections so we can verify.
  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the dev server and verify it boots**

Run: `npm run dev` (in a separate terminal or with `&` if scripting)
Expected: console output `> Ready on http://localhost:3000`. Visiting `http://localhost:3000` shows "Scaffold OK · Black Queen".

Kill the dev server (Ctrl+C) before continuing.

- [ ] **Step 3: Commit**

```bash
git add server.ts
git commit -m "Add custom Next.js + Socket.IO server"
```

---

## Task 3: Shared types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Define core domain + socket-event types**

Create `src/shared/types.ts`:

```typescript
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "Add shared domain and socket event types"
```

---

## Task 4: Room manager — codes + create

**Files:**
- Create: `src/server/rooms.ts`
- Create: `tests/unit/rooms.test.ts`

- [ ] **Step 1: Write failing tests for code generation + createRoom**

Create `tests/unit/rooms.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { generateRoomCode, createRoom, getRoom, _resetRoomsForTest } from '@/server/rooms';

beforeEach(() => _resetRoomsForTest());

describe('generateRoomCode', () => {
  it('returns 4 uppercase letters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-Z]{4}$/);
    }
  });
});

describe('createRoom', () => {
  it('creates a room with host as first player in seat 1', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    expect(room.code).toMatch(/^[A-Z]{4}$/);
    expect(room.phase).toBe('lobby');
    expect(room.players).toHaveLength(1);
    expect(room.players[0]).toMatchObject({ name: 'Dev', seat: 1, connected: true });
    expect(room.hostId).toBe(room.players[0].id);
    expect(sessionId).toBe(room.players[0].id);
  });

  it('makes the room retrievable by code', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    expect(getRoom(room.code)).toEqual(room);
  });

  it('rejects empty / too-long names', () => {
    expect(() => createRoom({ hostName: '' })).toThrow(/NAME_INVALID/);
    expect(() => createRoom({ hostName: 'a'.repeat(21) })).toThrow(/NAME_INVALID/);
  });

  it('trims whitespace and rejects whitespace-only names', () => {
    expect(() => createRoom({ hostName: '   ' })).toThrow(/NAME_INVALID/);
    const { room } = createRoom({ hostName: '  Dev  ' });
    expect(room.players[0].name).toBe('Dev');
  });

  it('generates unique codes for concurrent rooms', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(createRoom({ hostName: `User${i}` }).room.code);
    }
    expect(codes.size).toBe(50);
  });
});
```

- [ ] **Step 2: Run tests; expect them to fail (module doesn't exist)**

Run: `npm test`
Expected: tests fail with `Cannot find module '@/server/rooms'`.

- [ ] **Step 3: Implement `rooms.ts` to make tests pass**

Create `src/server/rooms.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests; expect them to pass**

Run: `npm test`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/rooms.ts tests/unit/rooms.test.ts
git commit -m "Add room manager: code generation + createRoom"
```

---

## Task 5: Room manager — joinRoom

**Files:**
- Modify: `src/server/rooms.ts`
- Modify: `tests/unit/rooms.test.ts`

- [ ] **Step 1: Add failing tests for joinRoom**

Append to `tests/unit/rooms.test.ts`:

```typescript
import { joinRoom } from '@/server/rooms';

describe('joinRoom', () => {
  it('adds a second player into seat 2', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = joinRoom({ code: room.code, name: 'Sam' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.players).toHaveLength(2);
    expect(res.room.players[1]).toMatchObject({ name: 'Sam', seat: 2, connected: true });
  });

  it('fills seats 2, 3, 4 in order', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    const res = joinRoom({ code: room.code, name: 'Aman' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const seats = res.room.players.map((p) => p.seat);
    expect(seats).toEqual([1, 2, 3, 4]);
  });

  it('rejects an unknown room code with NOT_FOUND', () => {
    const res = joinRoom({ code: 'ZZZZ', name: 'Sam' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NOT_FOUND');
  });

  it('rejects when the room is full (4 players)', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    joinRoom({ code: room.code, name: 'Aman' });
    const res = joinRoom({ code: room.code, name: 'Extra' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('FULL');
  });

  it('rejects duplicate names case-insensitively', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = joinRoom({ code: room.code, name: 'DEV' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NAME_TAKEN');
  });

  it('rejects invalid names', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = joinRoom({ code: room.code, name: '' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NAME_INVALID');
  });

  it('appends a system chat message on join', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = joinRoom({ code: room.code, name: 'Sam' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const last = res.room.chat[res.room.chat.length - 1];
    expect(last.authorId).toBeNull();
    expect(last.text).toMatch(/Sam joined/);
  });
});
```

- [ ] **Step 2: Run tests; expect failures (joinRoom not exported)**

Run: `npm test`
Expected: tests fail with "joinRoom is not a function" or similar import error.

- [ ] **Step 3: Implement joinRoom in `src/server/rooms.ts`**

Append to `src/server/rooms.ts`:

```typescript
import type { JoinRoomResult } from '@/shared/types';
import { MAX_PLAYERS } from '@/shared/types';

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
  const player: Player = { id, name, seat, connected: true };
  room.players.push(player);
  room.chat.push({
    id: randomUUID(),
    authorId: null,
    authorName: null,
    text: `${name} joined`,
    ts: Date.now(),
  });

  return { ok: true, sessionId: id, room };
}
```

- [ ] **Step 4: Run tests; expect them to pass**

Run: `npm test`
Expected: all (5 prior + 7 new) tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/rooms.ts tests/unit/rooms.test.ts
git commit -m "Add room manager: joinRoom with validation"
```

---

## Task 6: Room manager — leaveRoom, host transfer, chat

**Files:**
- Modify: `src/server/rooms.ts`
- Modify: `tests/unit/rooms.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/unit/rooms.test.ts`:

```typescript
import { leaveRoom, postChat } from '@/server/rooms';

describe('leaveRoom', () => {
  it('removes the player and reshuffles seats', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const join = joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    if (!join.ok) throw new Error('precondition');

    const res = leaveRoom({ code: room.code, sessionId: join.sessionId });
    expect(res.ok).toBe(true);
    if (!res.ok || res.wasLastPlayer) return;
    expect(res.room.players.map((p) => p.name)).toEqual(['Dev', 'Riya']);
    expect(res.room.players.map((p) => p.seat)).toEqual([1, 2]);
  });

  it('transfers host to the next remaining player when host leaves', () => {
    const { room, sessionId: hostId } = createRoom({ hostName: 'Dev' });
    const join = joinRoom({ code: room.code, name: 'Sam' });
    if (!join.ok) throw new Error('precondition');

    const res = leaveRoom({ code: room.code, sessionId: hostId });
    expect(res.ok).toBe(true);
    if (!res.ok || res.wasLastPlayer) return;
    expect(res.room.hostId).toBe(join.sessionId);
  });

  it('deletes the room entirely when the last player leaves', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    leaveRoom({ code: room.code, sessionId });
    expect(getRoom(room.code)).toBeUndefined();
  });

  it('returns NOT_FOUND for unknown room', () => {
    const res = leaveRoom({ code: 'ZZZZ', sessionId: 'fake' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NOT_FOUND');
  });

  it('appends a system chat message on leave (when room still exists)', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const join = joinRoom({ code: room.code, name: 'Sam' });
    if (!join.ok) throw new Error('precondition');
    const res = leaveRoom({ code: room.code, sessionId: join.sessionId });
    expect(res.ok).toBe(true);
    if (!res.ok || res.wasLastPlayer) return;
    const last = res.room.chat[res.room.chat.length - 1];
    expect(last.text).toMatch(/Sam left/);
  });
});

describe('postChat', () => {
  it('appends a chat message from a player', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    const res = postChat({ code: room.code, sessionId, text: 'hello' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const last = res.room.chat[res.room.chat.length - 1];
    expect(last).toMatchObject({ authorName: 'Dev', text: 'hello' });
  });

  it('trims whitespace and rejects empty', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    const res = postChat({ code: room.code, sessionId, text: '   ' });
    expect(res.ok).toBe(false);
  });

  it('caps message length at 200 chars', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    const res = postChat({ code: room.code, sessionId, text: 'a'.repeat(201) });
    expect(res.ok).toBe(false);
  });

  it('rejects from unknown sessionId', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const res = postChat({ code: room.code, sessionId: 'fake', text: 'hi' });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests; expect failures**

Run: `npm test`
Expected: 9 new failures (functions not exported).

- [ ] **Step 3: Implement `leaveRoom` and `postChat`**

Append to `src/server/rooms.ts`:

```typescript
type LeaveRoomResult =
  | { ok: true; room: Room; wasLastPlayer: false }
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
  | { ok: true; room: Room }
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
```

- [ ] **Step 4: Run tests; expect them to pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/rooms.ts tests/unit/rooms.test.ts
git commit -m "Add room manager: leaveRoom, host transfer, postChat"
```

---

## Task 7: Room manager — startGame + connection state

**Files:**
- Modify: `src/server/rooms.ts`
- Modify: `tests/unit/rooms.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/unit/rooms.test.ts`:

```typescript
import { startGame, setConnected } from '@/server/rooms';

describe('startGame', () => {
  it('moves phase from lobby to bidding when host starts with 4 players', () => {
    const { room, sessionId: hostId } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    joinRoom({ code: room.code, name: 'Aman' });

    const res = startGame({ code: room.code, sessionId: hostId });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.room.phase).toBe('bidding');
  });

  it('rejects with NEED_FOUR when fewer than 4 players', () => {
    const { room, sessionId: hostId } = createRoom({ hostName: 'Dev' });
    joinRoom({ code: room.code, name: 'Sam' });

    const res = startGame({ code: room.code, sessionId: hostId });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NEED_FOUR');
  });

  it('rejects non-host with NOT_HOST', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    const sam = joinRoom({ code: room.code, name: 'Sam' });
    joinRoom({ code: room.code, name: 'Riya' });
    joinRoom({ code: room.code, name: 'Aman' });
    if (!sam.ok) throw new Error('precondition');

    const res = startGame({ code: room.code, sessionId: sam.sessionId });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('NOT_HOST');
  });
});

describe('setConnected', () => {
  it('flips a player.connected flag', () => {
    const { room, sessionId } = createRoom({ hostName: 'Dev' });
    setConnected({ code: room.code, sessionId, connected: false });
    expect(getRoom(room.code)?.players[0].connected).toBe(false);
    setConnected({ code: room.code, sessionId, connected: true });
    expect(getRoom(room.code)?.players[0].connected).toBe(true);
  });

  it('is a no-op if the session is not in the room', () => {
    const { room } = createRoom({ hostName: 'Dev' });
    expect(() => setConnected({ code: room.code, sessionId: 'unknown', connected: false })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests; expect failures**

Run: `npm test`
Expected: 5 new failures.

- [ ] **Step 3: Implement `startGame` and `setConnected`**

Append to `src/server/rooms.ts`:

```typescript
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
  | { ok: true; room: Room }
  | { ok: false; error: 'NOT_HOST' | 'NEED_FOUR' };

export function startGame(input: StartGameInput): StartGameInternalResult {
  const room = rooms.get(input.code);
  if (!room) return { ok: false, error: 'NOT_HOST' }; // unknown room treated as not-authorized

  if (room.hostId !== input.sessionId) return { ok: false, error: 'NOT_HOST' };
  if (room.players.length < MAX_PLAYERS) return { ok: false, error: 'NEED_FOUR' };

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
```

- [ ] **Step 4: Run tests; expect them to pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/rooms.ts tests/unit/rooms.test.ts
git commit -m "Add room manager: startGame, setConnected"
```

---

## Task 8: Socket handlers — wire create + join

**Files:**
- Create: `src/server/socket.ts`
- Modify: `server.ts`
- Create: `tests/unit/socket.test.ts`

- [ ] **Step 1: Write a socket integration test for create + join**

Create `tests/unit/socket.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { attachSocketHandlers } from '@/server/socket';
import { _resetRoomsForTest } from '@/server/rooms';
import type { ClientToServerEvents, ServerToClientEvents, Room } from '@/shared/types';

let httpServer: HttpServer;
let io: SocketIOServer;
let port: number;

function makeClient(): ClientSocket<ServerToClientEvents, ClientToServerEvents> {
  return ioClient(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
}

beforeAll(async () => {
  httpServer = createServer();
  io = new SocketIOServer(httpServer);
  attachSocketHandlers(io);
  await new Promise<void>((r) => httpServer.listen(0, () => r()));
  const addr = httpServer.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  port = addr.port;
});

afterAll(async () => {
  io.close();
  await new Promise<void>((r) => httpServer.close(() => r()));
});

beforeEach(() => _resetRoomsForTest());

describe('socket: room:create', () => {
  it('creates a room and returns the room + sessionId', async () => {
    const c = makeClient();
    await new Promise<void>((r) => c.on('connect', () => r()));

    const res = await new Promise<any>((resolve) => {
      c.emit('room:create', { name: 'Dev' }, (r) => resolve(r));
    });

    expect(res.ok).toBe(true);
    expect(res.sessionId).toBeTruthy();
    expect(res.room.players[0].name).toBe('Dev');
    c.disconnect();
  });

  it('rejects empty name', async () => {
    const c = makeClient();
    await new Promise<void>((r) => c.on('connect', () => r()));

    const res = await new Promise<any>((resolve) => {
      c.emit('room:create', { name: '' }, (r) => resolve(r));
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBe('NAME_INVALID');
    c.disconnect();
  });
});

describe('socket: room:join', () => {
  it('lets a second client join a created room and both receive the updated state', async () => {
    const host = makeClient();
    const guest = makeClient();
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);

    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;

    // Both clients should receive a room:state when guest joins.
    const hostStatePromise = new Promise<Room>((resolve) => host.once('room:state', resolve));
    const guestStatePromise = new Promise<Room>((resolve) => guest.once('room:state', resolve));

    const joined: any = await new Promise((resolve) => guest.emit('room:join', { code, name: 'Sam' }, resolve));
    expect(joined.ok).toBe(true);

    const [hostState, guestState] = await Promise.all([hostStatePromise, guestStatePromise]);
    expect(hostState.players.map((p: any) => p.name)).toEqual(['Dev', 'Sam']);
    expect(guestState.players.map((p: any) => p.name)).toEqual(['Dev', 'Sam']);

    host.disconnect();
    guest.disconnect();
  });

  it('rejects join when code is unknown', async () => {
    const c = makeClient();
    await new Promise<void>((r) => c.on('connect', () => r()));
    const res: any = await new Promise((resolve) => c.emit('room:join', { code: 'ZZZZ', name: 'Sam' }, resolve));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('NOT_FOUND');
    c.disconnect();
  });

  it('rejects duplicate name', async () => {
    const c1 = makeClient();
    const c2 = makeClient();
    await Promise.all([
      new Promise<void>((r) => c1.on('connect', () => r())),
      new Promise<void>((r) => c2.on('connect', () => r())),
    ]);

    const created: any = await new Promise((resolve) => c1.emit('room:create', { name: 'Dev' }, resolve));
    const res: any = await new Promise((resolve) => c2.emit('room:join', { code: created.room.code, name: 'dev' }, resolve));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('NAME_TAKEN');

    c1.disconnect();
    c2.disconnect();
  });
});
```

Run: `npm test`
Expected: tests fail with "attachSocketHandlers is not a function" or import error.

- [ ] **Step 2: Implement `attachSocketHandlers` (create + join only for this task)**

Create `src/server/socket.ts`:

```typescript
import type { Server as SocketIOServer, Socket } from 'socket.io';
import { createRoom, joinRoom, getRoom, setConnected, postChat, leaveRoom, startGame } from './rooms';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Room,
} from '@/shared/types';

type SocketData = { sessionId?: string; roomCode?: string };
type SrvSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

function roomChannel(code: string): string {
  return `room:${code}`;
}

function broadcastState(io: SocketIOServer, room: Room): void {
  io.to(roomChannel(room.code)).emit('room:state', room);
}

export function attachSocketHandlers(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>): void {
  io.on('connection', (socket: SrvSocket) => {
    socket.on('room:create', ({ name }, cb) => {
      try {
        const { room, sessionId } = createRoom({ hostName: name });
        socket.data.sessionId = sessionId;
        socket.data.roomCode = room.code;
        socket.join(roomChannel(room.code));
        cb({ ok: true, sessionId, room });
        // No broadcast needed yet; the creator is the only one in the room.
      } catch (e) {
        cb({ ok: false, error: 'NAME_INVALID' });
      }
    });

    socket.on('room:join', ({ code, name }, cb) => {
      const res = joinRoom({ code, name });
      if (!res.ok) {
        cb(res);
        return;
      }
      socket.data.sessionId = res.sessionId;
      socket.data.roomCode = code;
      socket.join(roomChannel(code));
      cb(res);
      broadcastState(io, res.room);
    });

    // disconnect / leave / start / chat wired in later tasks.
  });
}
```

- [ ] **Step 3: Run tests; expect them to pass**

Run: `npm test`
Expected: all socket tests + earlier room tests pass.

- [ ] **Step 4: Wire `attachSocketHandlers` into `server.ts`**

Replace the placeholder `io.on('connection', …)` block in `server.ts` with:

```typescript
attachSocketHandlers(io);
```

Add the import at top:

```typescript
import { attachSocketHandlers } from './src/server/socket';
```

The full `server.ts` becomes:

```typescript
import { createServer } from 'node:http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { attachSocketHandlers } from './src/server/socket';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });
  const io = new SocketIOServer(httpServer, {
    cors: { origin: dev ? '*' : undefined },
  });
  attachSocketHandlers(io);
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Commit**

```bash
git add src/server/socket.ts tests/unit/socket.test.ts server.ts
git commit -m "Wire room:create and room:join socket events"
```

---

## Task 9: Socket handlers — disconnect + leave + chat

**Files:**
- Modify: `src/server/socket.ts`
- Modify: `tests/unit/socket.test.ts`

- [ ] **Step 1: Add failing socket tests for disconnect + chat**

Append to `tests/unit/socket.test.ts`:

```typescript
describe('socket: disconnect', () => {
  it('marks the player as disconnected and broadcasts updated state', async () => {
    const host = makeClient();
    const guest = makeClient();
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    await new Promise<void>((resolve) => {
      host.once('room:state', () => resolve());
      guest.emit('room:join', { code: created.room.code, name: 'Sam' }, () => {});
    });

    const hostStatePromise = new Promise<Room>((resolve) => host.once('room:state', resolve));
    guest.disconnect();
    const updated = await hostStatePromise;
    const sam = updated.players.find((p) => p.name === 'Sam');
    expect(sam?.connected).toBe(false);
    host.disconnect();
  });
});

describe('socket: chat:send', () => {
  it('broadcasts chat to everyone in the room', async () => {
    const host = makeClient();
    const guest = makeClient();
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    await new Promise<void>((resolve) => {
      host.once('room:state', () => resolve());
      guest.emit('room:join', { code: created.room.code, name: 'Sam' }, () => {});
    });

    const hostStatePromise = new Promise<Room>((resolve) => host.once('room:state', resolve));
    guest.emit('chat:send', { text: 'hello' });
    const updated = await hostStatePromise;
    const last = updated.chat[updated.chat.length - 1];
    expect(last.text).toBe('hello');
    expect(last.authorName).toBe('Sam');

    host.disconnect();
    guest.disconnect();
  });
});
```

Run: `npm test`
Expected: 2 new failures.

- [ ] **Step 2: Implement disconnect, leave, chat handlers**

Replace the `socket.on('room:join', …)` block in `src/server/socket.ts` with the same handler, and add the following handlers after it (still inside the `io.on('connection', …)` callback):

```typescript
    socket.on('chat:send', ({ text }) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      const res = postChat({ code: roomCode, sessionId, text });
      if (res.ok) broadcastState(io, res.room);
    });

    socket.on('room:leave', () => {
      handleLeave(socket);
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

function handleLeave(socket: SrvSocket): void {
  const { sessionId, roomCode } = socket.data;
  if (!sessionId || !roomCode) return;
  const res = leaveRoom({ code: roomCode, sessionId });
  socket.leave(roomChannel(roomCode));
  socket.data.sessionId = undefined;
  socket.data.roomCode = undefined;
  if (res.ok && !res.wasLastPlayer) {
    // We need access to `io` here. Refactor: pass io into handleLeave or
    // keep the handler inline.
  }
}
```

Hmm — `handleLeave` needs `io`. Refactor: keep the leave logic inline inside the `io.on('connection', …)` callback so it closes over `io`. The complete `src/server/socket.ts` after this task is:

```typescript
import type { Server as SocketIOServer, Socket } from 'socket.io';
import { createRoom, joinRoom, getRoom, setConnected, postChat, leaveRoom } from './rooms';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Room,
} from '@/shared/types';

type SocketData = { sessionId?: string; roomCode?: string };
type Srv = SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type SrvSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

function roomChannel(code: string): string {
  return `room:${code}`;
}

function broadcastState(io: Srv, room: Room): void {
  io.to(roomChannel(room.code)).emit('room:state', room);
}

export function attachSocketHandlers(io: Srv): void {
  io.on('connection', (socket: SrvSocket) => {
    socket.on('room:create', ({ name }, cb) => {
      try {
        const { room, sessionId } = createRoom({ hostName: name });
        socket.data.sessionId = sessionId;
        socket.data.roomCode = room.code;
        socket.join(roomChannel(room.code));
        cb({ ok: true, sessionId, room });
      } catch {
        cb({ ok: false, error: 'NAME_INVALID' });
      }
    });

    socket.on('room:join', ({ code, name }, cb) => {
      const res = joinRoom({ code, name });
      if (!res.ok) {
        cb(res);
        return;
      }
      socket.data.sessionId = res.sessionId;
      socket.data.roomCode = code;
      socket.join(roomChannel(code));
      cb(res);
      broadcastState(io, res.room);
    });

    socket.on('chat:send', ({ text }) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      const res = postChat({ code: roomCode, sessionId, text });
      if (res.ok) broadcastState(io, res.room);
    });

    socket.on('room:leave', () => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) return;
      const res = leaveRoom({ code: roomCode, sessionId });
      socket.leave(roomChannel(roomCode));
      socket.data.sessionId = undefined;
      socket.data.roomCode = undefined;
      if (res.ok && !res.wasLastPlayer && res.room) broadcastState(io, res.room);
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

- [ ] **Step 3: Run tests; expect them to pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/socket.ts tests/unit/socket.test.ts
git commit -m "Add disconnect, leave, and chat socket handlers"
```

---

## Task 10: Socket handlers — start game

**Files:**
- Modify: `src/server/socket.ts`
- Modify: `tests/unit/socket.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/unit/socket.test.ts`:

```typescript
describe('socket: room:start', () => {
  it('lets the host start with 4 players; phase becomes bidding for everyone', async () => {
    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await Promise.all(clients.map((c) => new Promise<void>((r) => c.on('connect', () => r()))));

    const [host, c2, c3, c4] = clients;
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const code = created.room.code;
    for (const [client, name] of [[c2, 'Sam'], [c3, 'Riya'], [c4, 'Aman']] as const) {
      await new Promise<void>((resolve) =>
        client.emit('room:join', { code, name }, () => resolve())
      );
    }

    // Listen for the state update on all clients
    const statePromises = clients.map((c) => new Promise<Room>((resolve) => c.once('room:state', resolve)));

    const res: any = await new Promise((resolve) => host.emit('room:start', resolve));
    expect(res.ok).toBe(true);

    const states = await Promise.all(statePromises);
    for (const state of states) {
      expect(state.phase).toBe('bidding');
    }
    clients.forEach((c) => c.disconnect());
  });

  it('rejects a non-host with NOT_HOST', async () => {
    const host = makeClient();
    const guest = makeClient();
    await Promise.all([
      new Promise<void>((r) => host.on('connect', () => r())),
      new Promise<void>((r) => guest.on('connect', () => r())),
    ]);
    const created: any = await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    await new Promise((resolve) => guest.emit('room:join', { code: created.room.code, name: 'Sam' }, resolve));
    const res: any = await new Promise((resolve) => guest.emit('room:start', resolve));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('NOT_HOST');
    host.disconnect();
    guest.disconnect();
  });

  it('rejects with NEED_FOUR when fewer than 4 players', async () => {
    const host = makeClient();
    await new Promise<void>((r) => host.on('connect', () => r()));
    await new Promise((resolve) => host.emit('room:create', { name: 'Dev' }, resolve));
    const res: any = await new Promise((resolve) => host.emit('room:start', resolve));
    expect(res.ok).toBe(false);
    expect(res.error).toBe('NEED_FOUR');
    host.disconnect();
  });
});
```

Run: `npm test`
Expected: 3 new failures.

- [ ] **Step 2: Add the `room:start` handler**

Add to `src/server/socket.ts` (inside the `io.on('connection', …)` body, before `disconnect`):

```typescript
    socket.on('room:start', (cb) => {
      const { sessionId, roomCode } = socket.data;
      if (!sessionId || !roomCode) {
        cb({ ok: false, error: 'NOT_HOST' });
        return;
      }
      const res = startGame({ code: roomCode, sessionId });
      if (!res.ok) {
        cb({ ok: false, error: res.error });
        return;
      }
      cb({ ok: true });
      if (res.room) broadcastState(io, res.room);
    });
```

Update the import at the top of `src/server/socket.ts` to include `startGame`:

```typescript
import { createRoom, joinRoom, getRoom, setConnected, postChat, leaveRoom, startGame } from './rooms';
```

- [ ] **Step 3: Run tests; expect them to pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/socket.ts tests/unit/socket.test.ts
git commit -m "Add room:start socket event"
```

---

## Task 11: Client-side socket + Zustand store

**Files:**
- Create: `src/client/store.ts`
- Create: `src/client/useSocket.ts`

This task has no automated tests (it would require browser/jsdom setup); we rely on the Playwright E2E in Task 21 to cover client integration. Keep both files small and obviously correct.

- [ ] **Step 1: Create the Zustand store**

Create `src/client/store.ts`:

```typescript
'use client';
import { create } from 'zustand';
import type { Room, Player } from '@/shared/types';

export interface GameStore {
  /** Server-issued session id for this browser tab in the current room. */
  sessionId: string | null;
  /** Current room state as last broadcast from the server. */
  room: Room | null;
  /** True once the socket is connected. */
  connected: boolean;

  setSession(sessionId: string): void;
  setRoom(room: Room | null): void;
  setConnected(c: boolean): void;
  reset(): void;
}

export const useGameStore = create<GameStore>((set) => ({
  sessionId: null,
  room: null,
  connected: false,
  setSession: (sessionId) => set({ sessionId }),
  setRoom: (room) => set({ room }),
  setConnected: (connected) => set({ connected }),
  reset: () => set({ sessionId: null, room: null }),
}));

/** Convenience selectors */
export function selectMe(state: GameStore): Player | null {
  if (!state.room || !state.sessionId) return null;
  return state.room.players.find((p) => p.id === state.sessionId) ?? null;
}
```

- [ ] **Step 2: Create the `useSocket` hook**

Create `src/client/useSocket.ts`:

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/types';
import { useGameStore } from './store';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let singletonSocket: ClientSocket | null = null;

/** Returns a stable singleton client socket. Connects on first call. */
export function useSocket(): ClientSocket {
  const ref = useRef<ClientSocket | null>(singletonSocket);
  const setConnected = useGameStore((s) => s.setConnected);
  const setRoom = useGameStore((s) => s.setRoom);

  if (!ref.current) {
    singletonSocket = io({ transports: ['websocket'] });
    ref.current = singletonSocket;
  }

  useEffect(() => {
    const socket = ref.current!;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onRoomState = (room: any) => setRoom(room);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
    };
  }, [setConnected, setRoom]);

  return ref.current!;
}
```

- [ ] **Step 3: Verify typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/client/
git commit -m "Add client Zustand store and useSocket hook"
```

---

## Task 12: Landing page

**Files:**
- Create: `src/components/Avatar.tsx`
- Replace: `src/app/page.tsx`

- [ ] **Step 1: Add a simple Avatar component**

Create `src/components/Avatar.tsx`:

```tsx
interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
}

const PRESET_COLORS = ['#5b8def', '#e74c3c', '#27ae60', '#f4c842'];

export function colorForName(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PRESET_COLORS[hash % PRESET_COLORS.length];
}

export function Avatar({ name, color, size = 36 }: AvatarProps) {
  const bg = color ?? colorForName(name);
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}
```

- [ ] **Step 2: Replace landing page with the real one**

Replace `src/app/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { useGameStore } from '@/client/store';
import type { CreateRoomResult, JoinRoomResult } from '@/shared/types';

export default function LandingPage() {
  const socket = useSocket();
  const router = useRouter();
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function withSubmit(fn: () => Promise<void>) {
    return async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    };
  }

  const handleCreate = withSubmit(async () => {
    if (!name.trim()) {
      setError('Pick a display name');
      return;
    }
    const res = await new Promise<CreateRoomResult>((resolve) =>
      socket.emit('room:create', { name: name.trim() }, resolve)
    );
    if (!res.ok) {
      setError(res.error === 'NAME_INVALID' ? 'Name must be 1–20 characters.' : 'Could not create room.');
      return;
    }
    setSession(res.sessionId);
    setRoom(res.room);
    router.push(`/room/${res.room.code}`);
  });

  const handleJoin = withSubmit(async () => {
    const cleanCode = code.toUpperCase().replace(/[^A-Z]/g, '');
    if (cleanCode.length !== 4) {
      setError('Room code must be 4 letters.');
      return;
    }
    if (!name.trim()) {
      setError('Pick a display name');
      return;
    }
    const res = await new Promise<JoinRoomResult>((resolve) =>
      socket.emit('room:join', { code: cleanCode, name: name.trim() }, resolve)
    );
    if (!res.ok) {
      setError(
        res.error === 'NOT_FOUND' ? 'Room not found.'
        : res.error === 'FULL' ? 'Room is full.'
        : res.error === 'NAME_TAKEN' ? 'Name is taken in that room.'
        : 'Invalid name.'
      );
      return;
    }
    setSession(res.sessionId);
    setRoom(res.room);
    router.push(`/room/${cleanCode}`);
  });

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">
      <div className="text-center">
        <div className="text-gold-500 text-6xl font-serif leading-none">♛</div>
        <div className="text-2xl font-bold mt-1">Black Queen</div>
        <div className="text-xs text-neutral-400 mt-1">A 4-player trick-taking card game</div>
      </div>

      <div className="w-80 bg-black/40 border border-white/10 rounded-xl p-5 shadow-2xl">
        <form className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">
              Your display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500"
              placeholder="e.g. Dev"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-black font-bold rounded-lg py-2.5 text-sm"
          >
            Create a new room
          </button>

          <div className="text-center text-[10px] uppercase tracking-widest text-neutral-500 my-2">
            or join an existing room
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-400 mb-1">Room code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold-500 uppercase tracking-widest text-center font-mono text-gold-500"
              placeholder="ABCD"
            />
          </div>

          <button
            type="button"
            onClick={handleJoin}
            disabled={busy}
            className="w-full bg-transparent hover:border-gold-500 hover:text-gold-500 border border-white/20 text-neutral-200 rounded-lg py-2.5 text-sm font-bold"
          >
            Join room
          </button>

          {error && <div className="text-red-400 text-xs text-center">{error}</div>}
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Boot the dev server and smoke-test the landing page**

Run: `npm run dev` (in a separate terminal)
Open: `http://localhost:3000`
Verify: the landing card renders, has the logo, both buttons visible. Don't submit yet — waiting room is built next.

Kill dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/Avatar.tsx src/app/page.tsx
git commit -m "Add landing page with create/join actions"
```

---

## Task 13: Seat component

**Files:**
- Create: `src/components/Seat.tsx`

- [ ] **Step 1: Implement the Seat component**

Create `src/components/Seat.tsx`:

```tsx
import { Avatar, colorForName } from './Avatar';
import type { Player } from '@/shared/types';

interface SeatProps {
  player: Player | null;
  seatLabel: string;      // e.g. "seat 2"
  isYou?: boolean;
  isHost?: boolean;
}

export function Seat({ player, seatLabel, isYou, isHost }: SeatProps) {
  const empty = player === null;

  return (
    <div
      className={
        empty
          ? 'w-40 text-center bg-white/[0.03] border-2 border-dashed border-white/20 rounded-xl p-3 text-neutral-500'
          : isYou
          ? 'w-40 text-center bg-gold-500/15 border-2 border-gold-500 rounded-xl p-3'
          : 'w-40 text-center bg-black/40 border-2 border-white/20 rounded-xl p-3'
      }
    >
      {empty ? (
        <div
          className="w-12 h-12 rounded-full mx-auto mb-1.5 flex items-center justify-center text-2xl text-neutral-500 border-2 border-dashed border-white/20 bg-white/5"
          aria-hidden
        >
          +
        </div>
      ) : (
        <div className="mb-1.5">
          <Avatar name={player.name} color={colorForName(player.name)} size={48} />
        </div>
      )}
      <div className="text-sm font-semibold">{empty ? 'Waiting…' : player.name}</div>
      <div
        className={
          isHost ? 'text-[9px] uppercase tracking-wider text-gold-500 font-bold mt-0.5' : 'text-[9px] uppercase tracking-wider text-neutral-400 mt-0.5'
        }
      >
        {isHost ? '★ host · ' : ''}{isYou ? 'you · ' : ''}{seatLabel}
      </div>
      {!empty && !player.connected && (
        <div className="mt-1 text-[10px] text-amber-400">Disconnected</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/Seat.tsx
git commit -m "Add Seat component"
```

---

## Task 14: InviteCard component

**Files:**
- Create: `src/components/InviteCard.tsx`

- [ ] **Step 1: Implement InviteCard**

Create `src/components/InviteCard.tsx`:

```tsx
'use client';
import { useState } from 'react';

interface InviteCardProps {
  code: string;
  url: string;
  disabled?: boolean;
}

export function InviteCard({ code, url, disabled }: InviteCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className={
        disabled
          ? 'w-56 bg-black/40 border border-gold-500/20 rounded-xl p-4 opacity-50'
          : 'w-56 bg-black/40 border border-gold-500/40 rounded-xl p-4 shadow-xl'
      }
    >
      <div className="text-[9px] uppercase tracking-widest text-neutral-400 text-center mb-1.5">
        {disabled ? 'Room full' : 'Invite friends · room code'}
      </div>
      <div className="font-mono text-2xl font-bold text-gold-500 text-center tracking-widest">
        {code}
      </div>
      <div className="text-[10px] font-mono text-neutral-500 text-center mt-1 break-all">
        {url}
      </div>
      <button
        type="button"
        onClick={copy}
        disabled={disabled}
        className={
          disabled
            ? 'w-full mt-2.5 bg-white/5 border border-white/10 text-neutral-500 text-xs font-semibold rounded-lg py-1.5'
            : copied
            ? 'w-full mt-2.5 bg-green-500/15 border border-green-400/40 text-green-400 text-xs font-semibold rounded-lg py-1.5'
            : 'w-full mt-2.5 bg-gold-500/20 border border-gold-500/40 text-gold-500 hover:bg-gold-500/30 text-xs font-semibold rounded-lg py-1.5'
        }
      >
        {disabled ? 'Link locked' : copied ? '✓ Copied!' : 'Copy invite link'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/InviteCard.tsx
git commit -m "Add InviteCard component"
```

---

## Task 15: StartCard component

**Files:**
- Create: `src/components/StartCard.tsx`

- [ ] **Step 1: Implement StartCard**

Create `src/components/StartCard.tsx`:

```tsx
interface StartCardProps {
  filled: number;     // current player count
  isHost: boolean;
  onStart?: () => void;
}

export function StartCard({ filled, isHost, onStart }: StartCardProps) {
  const ready = filled >= 4;
  const sub =
    !ready
      ? `Need ${4 - filled} more to start`
      : isHost
      ? "Everyone seated · let's play"
      : 'Waiting for host to start…';

  return (
    <div
      className={
        ready
          ? 'w-56 bg-black/40 border border-gold-500/60 rounded-xl p-4 shadow-xl shadow-gold-500/10 text-center'
          : 'w-56 bg-black/40 border border-white/15 rounded-xl p-4 text-center'
      }
    >
      <div className="text-[9px] uppercase tracking-widest text-neutral-400 mb-1.5">
        Players ready
      </div>
      <div className="text-2xl font-bold">
        <span className={ready ? 'text-gold-500' : 'text-gold-500'}>{filled}</span>
        <span className="text-neutral-500">/4</span>
      </div>
      <div className={ready ? 'text-[10px] text-gold-500 mb-2.5' : 'text-[10px] text-neutral-400 mb-2.5'}>
        {sub}
      </div>
      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          className={
            ready
              ? 'w-full bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-lg py-2 text-sm'
              : 'w-full bg-white/5 text-neutral-500 cursor-not-allowed rounded-lg py-2 text-sm font-bold'
          }
        >
          Start Game
        </button>
      ) : (
        <div className="text-[10px] italic text-neutral-500 py-2">…</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/StartCard.tsx
git commit -m "Add StartCard component"
```

---

## Task 16: ChatPanel component

**Files:**
- Create: `src/components/ChatPanel.tsx`

- [ ] **Step 1: Implement ChatPanel**

Create `src/components/ChatPanel.tsx`:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/shared/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  }

  return (
    <div className="w-52 bg-black/50 border border-white/15 rounded-lg p-2.5 text-xs">
      <div ref={scrollRef} className="flex flex-col gap-0.5 max-h-32 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div key={m.id}>
            {m.authorName ? (
              <span>
                <b className="text-gold-500">{m.authorName}:</b> {m.text}
              </span>
            ) : (
              <span className="text-neutral-500 italic">{m.text}</span>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="mt-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder="Type a message…"
          className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-xs outline-none focus:border-gold-500"
        />
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "Add ChatPanel component"
```

---

## Task 17: Waiting room page

**Files:**
- Create: `src/app/room/[code]/page.tsx`

- [ ] **Step 1: Implement the waiting-room page**

Create `src/app/room/[code]/page.tsx`:

```tsx
'use client';
import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { selectMe, useGameStore } from '@/client/store';
import { Seat } from '@/components/Seat';
import { InviteCard } from '@/components/InviteCard';
import { StartCard } from '@/components/StartCard';
import { ChatPanel } from '@/components/ChatPanel';
import type { Player, StartGameResult } from '@/shared/types';

/**
 * Given a viewer's seat (1..4), return the seat numbers in this visual order:
 *   bottom (viewer), left, top, right.
 * Turn order is clockwise around seats 1→2→3→4. From the viewer's perspective,
 * clockwise = bottom → left → top → right.
 */
function rotateSeats(viewerSeat: 1 | 2 | 3 | 4): { bottom: number; left: number; top: number; right: number } {
  return {
    bottom: viewerSeat,
    left: (viewerSeat % 4) + 1,
    top: ((viewerSeat + 1) % 4) + 1,
    right: ((viewerSeat + 2) % 4) + 1,
  };
}

export default function WaitingRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const router = useRouter();
  const socket = useSocket();

  const room = useGameStore((s) => s.room);
  const sessionId = useGameStore((s) => s.sessionId);
  const me = useGameStore(selectMe);

  // If we navigate here directly without a session, route back to landing.
  useEffect(() => {
    if (!sessionId) router.replace('/');
  }, [sessionId, router]);

  // Once the phase is past lobby, route to the game-starting placeholder.
  useEffect(() => {
    if (room && room.phase !== 'lobby') {
      router.push('/game-starting');
    }
  }, [room?.phase, router]);

  const seatLayout = useMemo(() => {
    if (!me) return null;
    return rotateSeats(me.seat);
  }, [me?.seat]);

  if (!room || !me || !seatLayout) {
    return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;
  }

  const playerAt = (seat: number): Player | null =>
    room.players.find((p) => p.seat === seat) ?? null;

  function handleStart() {
    socket.emit('room:start', (res: StartGameResult) => {
      if (!res.ok) {
        // Soft error; could surface via toast later.
        console.warn('Start failed:', res.error);
      }
    });
  }

  function handleSendChat(text: string) {
    socket.emit('chat:send', { text });
  }

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${room.code}` : `/room/${room.code}`;
  const isHost = room.hostId === sessionId;
  const isFull = room.players.length >= 4;

  return (
    <main className="min-h-screen p-6">
      {/* Header strip */}
      <div className="flex items-center justify-between mb-4 max-w-3xl mx-auto">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-neutral-400">Room</div>
          <div className="text-xl font-bold text-gold-500 font-mono tracking-widest">{room.code}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-widest text-neutral-400">Players</div>
          <div className="text-sm font-semibold">
            <span className={isFull ? 'text-gold-500' : 'text-gold-500'}>{room.players.length}</span> / 4
          </div>
        </div>
      </div>

      {/* Diamond seating */}
      <div className="relative mx-auto max-w-3xl h-72">
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
          <Seat
            player={playerAt(seatLayout.top)}
            seatLabel={`seat ${seatLayout.top}`}
            isHost={!!playerAt(seatLayout.top) && playerAt(seatLayout.top)!.id === room.hostId}
          />
        </div>
        <div className="absolute top-1/2 left-8 -translate-y-1/2">
          <Seat
            player={playerAt(seatLayout.left)}
            seatLabel={`seat ${seatLayout.left}`}
            isHost={!!playerAt(seatLayout.left) && playerAt(seatLayout.left)!.id === room.hostId}
          />
        </div>
        <div className="absolute top-1/2 right-8 -translate-y-1/2">
          <Seat
            player={playerAt(seatLayout.right)}
            seatLabel={`seat ${seatLayout.right}`}
            isHost={!!playerAt(seatLayout.right) && playerAt(seatLayout.right)!.id === room.hostId}
          />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <Seat
            player={me}
            seatLabel={`seat ${seatLayout.bottom}`}
            isYou
            isHost={isHost}
          />
        </div>
      </div>

      {/* Two cards: invite + start */}
      <div className="flex justify-center gap-4 mt-4">
        <InviteCard code={room.code} url={inviteUrl} disabled={isFull} />
        <StartCard filled={room.players.length} isHost={isHost} onStart={handleStart} />
      </div>

      {/* Chat panel — bottom-right */}
      <div className="fixed bottom-3 right-3">
        <ChatPanel messages={room.chat} onSend={handleSendChat} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify typechecks**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/room/
git commit -m "Add waiting room page"
```

---

## Task 18: Direct-link join screen

**Files:**
- Modify: `src/app/room/[code]/page.tsx`

When someone opens `/room/ABCD` directly (e.g., clicked an invite link) without having created/joined first, the page currently routes back to landing. Improve this: show a join form pre-filled with the code.

- [ ] **Step 1: Add the join-via-link UI to the same page**

Replace `src/app/room/[code]/page.tsx` with:

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/client/useSocket';
import { selectMe, useGameStore } from '@/client/store';
import { Seat } from '@/components/Seat';
import { InviteCard } from '@/components/InviteCard';
import { StartCard } from '@/components/StartCard';
import { ChatPanel } from '@/components/ChatPanel';
import type { JoinRoomResult, Player, StartGameResult } from '@/shared/types';

function rotateSeats(viewerSeat: 1 | 2 | 3 | 4) {
  return {
    bottom: viewerSeat,
    left: (viewerSeat % 4) + 1,
    top: ((viewerSeat + 1) % 4) + 1,
    right: ((viewerSeat + 2) % 4) + 1,
  };
}

export default function WaitingRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? '').toUpperCase();
  const router = useRouter();
  const socket = useSocket();

  const room = useGameStore((s) => s.room);
  const sessionId = useGameStore((s) => s.sessionId);
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const me = useGameStore(selectMe);

  const [joinName, setJoinName] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);

  useEffect(() => {
    if (room && room.phase !== 'lobby') router.push('/game-starting');
  }, [room?.phase, router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinErr(null);
    if (!joinName.trim()) {
      setJoinErr('Pick a display name');
      return;
    }
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

  // Not in the room yet — show the join form.
  if (!sessionId || !me) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6">
        <div className="text-center">
          <div className="text-gold-500 text-5xl font-serif leading-none">♛</div>
          <div className="text-xl font-bold mt-1">Black Queen</div>
        </div>
        <div className="w-80 bg-black/40 border border-white/10 rounded-xl p-5">
          <div className="text-center text-xs text-neutral-400">You've been invited to room</div>
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

  // In the room — render the waiting room.
  const seatLayout = rotateSeats(me.seat);
  const playerAt = (seat: number): Player | null =>
    room?.players.find((p) => p.seat === seat) ?? null;

  function handleStart() {
    socket.emit('room:start', (res: StartGameResult) => {
      if (!res.ok) console.warn('Start failed:', res.error);
    });
  }

  function handleSendChat(text: string) {
    socket.emit('chat:send', { text });
  }

  if (!room) {
    return <main className="min-h-screen flex items-center justify-center text-neutral-500">Loading…</main>;
  }

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
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
          <Seat
            player={playerAt(seatLayout.top)}
            seatLabel={`seat ${seatLayout.top}`}
            isHost={!!playerAt(seatLayout.top) && playerAt(seatLayout.top)!.id === room.hostId}
          />
        </div>
        <div className="absolute top-1/2 left-8 -translate-y-1/2">
          <Seat
            player={playerAt(seatLayout.left)}
            seatLabel={`seat ${seatLayout.left}`}
            isHost={!!playerAt(seatLayout.left) && playerAt(seatLayout.left)!.id === room.hostId}
          />
        </div>
        <div className="absolute top-1/2 right-8 -translate-y-1/2">
          <Seat
            player={playerAt(seatLayout.right)}
            seatLabel={`seat ${seatLayout.right}`}
            isHost={!!playerAt(seatLayout.right) && playerAt(seatLayout.right)!.id === room.hostId}
          />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <Seat player={me} seatLabel={`seat ${seatLayout.bottom}`} isYou isHost={isHost} />
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-4">
        <InviteCard code={room.code} url={inviteUrl} disabled={isFull} />
        <StartCard filled={room.players.length} isHost={isHost} onStart={handleStart} />
      </div>

      <div className="fixed bottom-3 right-3">
        <ChatPanel messages={room.chat} onSend={handleSendChat} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Smoke-test in browser**

Run: `npm run dev`
- In Browser A: visit `/`, enter name "Dev", click "Create a new room". Verify route → `/room/ABCD` (some random 4-letter code) and a seat for Dev appears at bottom with the gold ★ host badge.
- Copy the URL from the address bar. Open it in Browser B. Verify the join form appears with the room code shown.
- Enter "Sam" and join. Browser A should now show Sam in another seat. Browser B should show Dev at the top.

Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/room/
git commit -m "Support direct-link join via /room/[code] without prior landing visit"
```

---

## Task 19: Game-starting placeholder page

**Files:**
- Create: `src/app/game-starting/page.tsx`

- [ ] **Step 1: Add the placeholder**

Create `src/app/game-starting/page.tsx`:

```tsx
'use client';
import { useGameStore } from '@/client/store';

export default function GameStartingPage() {
  const room = useGameStore((s) => s.room);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <div className="text-gold-500 text-5xl font-serif">♛</div>
      <div className="text-2xl font-bold">Game starting…</div>
      <div className="text-sm text-neutral-400">
        Phase: <b className="text-gold-500">{room?.phase ?? 'unknown'}</b>
      </div>
      <div className="text-xs text-neutral-500 mt-2">
        (Bidding UI lands in Plan 2.)
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Smoke-test**

Run: `npm run dev`
Open 4 browser tabs. Create a room, join from the other three, click Start Game in the host's tab. All 4 tabs should navigate to `/game-starting` and show "Phase: bidding".

Kill dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/game-starting/
git commit -m "Add game-starting placeholder page"
```

---

## Task 20: E2E test — full lobby flow with Playwright

**Files:**
- Create: `tests/e2e/lobby.spec.ts`

- [ ] **Step 1: Install Playwright browsers**

Run: `npx playwright install --with-deps chromium`
Expected: downloads Chromium for Playwright (only needed once per machine).

- [ ] **Step 2: Write the E2E test**

Create `tests/e2e/lobby.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('host creates a room, three guests join via link, host starts the game', async ({ browser }) => {
  // 4 separate browser contexts simulate 4 different players.
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [host, g1, g2, g3] = pages;

  // Host creates the room.
  await host.goto('/');
  await host.getByPlaceholder('e.g. Dev').fill('Dev');
  await host.getByRole('button', { name: /Create a new room/i }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z]{4}/);
  const roomUrl = host.url();
  const code = roomUrl.match(/\/room\/([A-Z]{4})/)![1];

  // Host sees their own seat with host badge.
  await expect(host.getByText('Dev')).toBeVisible();
  await expect(host.getByText(/★ host/i)).toBeVisible();

  // Guests join via the room URL.
  for (const [page, name] of [
    [g1, 'Sam'],
    [g2, 'Riya'],
    [g3, 'Aman'],
  ] as const) {
    await page.goto(roomUrl);
    await page.getByPlaceholder('Pick something fun').fill(name);
    await page.getByRole('button', { name: /Join room/i }).click();
    await expect(page.getByText(name).first()).toBeVisible();
  }

  // Host's view should now see all 4 players.
  for (const name of ['Dev', 'Sam', 'Riya', 'Aman']) {
    await expect(host.getByText(name, { exact: true }).first()).toBeVisible();
  }
  await expect(host.getByText('4 / 4')).toBeVisible();

  // Host starts the game.
  await host.getByRole('button', { name: /^Start Game$/ }).click();

  // All 4 pages should transition to /game-starting.
  for (const page of pages) {
    await expect(page).toHaveURL(/\/game-starting/);
    await expect(page.getByText(/Phase:/)).toBeVisible();
  }

  await Promise.all(contexts.map((c) => c.close()));
});

test('attempting to start with fewer than 4 players keeps the Start button disabled', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByPlaceholder('e.g. Dev').fill('Solo');
  await page.getByRole('button', { name: /Create a new room/i }).click();

  await expect(page).toHaveURL(/\/room\/[A-Z]{4}/);
  const startBtn = page.getByRole('button', { name: /^Start Game$/ });
  await expect(startBtn).toBeDisabled();

  await ctx.close();
});

test('joining with a duplicate name fails gracefully', async ({ browser }) => {
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();

  await p1.goto('/');
  await p1.getByPlaceholder('e.g. Dev').fill('Dev');
  await p1.getByRole('button', { name: /Create a new room/i }).click();
  await expect(p1).toHaveURL(/\/room\/[A-Z]{4}/);
  const roomUrl = p1.url();

  await p2.goto(roomUrl);
  await p2.getByPlaceholder('Pick something fun').fill('dev'); // case-insensitive duplicate
  await p2.getByRole('button', { name: /Join room/i }).click();

  await expect(p2.getByText(/Name is taken/i)).toBeVisible();

  await Promise.all([c1.close(), c2.close()]);
});
```

- [ ] **Step 3: Run the E2E tests**

Run: `npm run test:e2e`
Expected: all 3 tests pass. Playwright will auto-start the dev server (per `playwright.config.ts`'s `webServer` block).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/lobby.spec.ts
git commit -m "Add Playwright E2E test for full lobby flow"
```

---

## Task 21: Final smoke + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Add a project README so anyone can run it**

Create `README.md`:

````markdown
# Black Queen

4-player browser-based trick-taking card game. WIP.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 in 4 browser windows (or use incognito/private windows for separate sessions). One window creates a room, the others join via the URL.

## Scripts

- `npm run dev` — start the dev server (Next.js + Socket.IO).
- `npm run test` — run unit tests (Vitest).
- `npm run test:e2e` — run end-to-end tests (Playwright).
- `npm run lint` — lint the codebase.
- `npm run format` — Prettier-format everything.

## Layout

- `server.ts` — custom Next.js + Socket.IO HTTP server.
- `src/app/` — Next.js App Router pages (`/`, `/room/[code]`, `/game-starting`).
- `src/server/rooms.ts` — pure room manager (state + transitions).
- `src/server/socket.ts` — Socket.IO event handlers.
- `src/client/` — Zustand store + `useSocket` hook.
- `src/components/` — UI components.
- `src/shared/types.ts` — domain + event types shared between server and client.
- `tests/unit/` — Vitest tests.
- `tests/e2e/` — Playwright tests.

## Plans

See `docs/superpowers/plans/`. This plan (Plan 1) builds scaffold + lobby/rooms. Subsequent plans add the game engine, bidding, trump/partner selection, trick play, scoring, and disconnect handling.

## Spec

`docs/superpowers/specs/2026-05-12-black-queen-game-design.md`.
````

- [ ] **Step 2: Final full-stack smoke**

Run: `npm run lint && npm run test && npm run test:e2e`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Add README"
```

---

## Done criteria for Plan 1

- [ ] `npm run dev` boots a working app at `http://localhost:3000`.
- [ ] Landing page lets you create a room or paste a 4-letter code to join.
- [ ] Creating a room navigates to `/room/<CODE>` with you in the bottom seat, host-badged.
- [ ] Sharing the URL lets others join; their seat appears in everyone's view, with view-rotation so each viewer sees themselves at the bottom.
- [ ] Invite card shows the 4-letter code, full URL, and a working Copy button (turns green briefly).
- [ ] Start card shows "X/4" and is disabled until 4 players are seated; host can click it when 4/4.
- [ ] Clicking Start Game navigates everyone to `/game-starting` with phase = "bidding".
- [ ] Chat panel works during the lobby; messages broadcast to everyone.
- [ ] Disconnecting a tab marks that player as "Disconnected" in everyone else's view; reconnecting (just reload — full reconnect handling is Plan 5) starts a fresh session.
- [ ] `npm run test` passes (room manager + socket handler unit tests).
- [ ] `npm run test:e2e` passes (full lobby flow in Playwright).

---

## Open questions (carried forward to Plan 2)

- Per-player private state (each player's hand) — Plan 2 introduces hidden information; `room:state` will need to be replaced by `state:public` (everyone) + `state:private:<seat>` (only that seat) emit patterns.
- Reconnection: this plan treats refresh as a fresh session (you'd need to re-enter your name). Real reconnect via session-token persistence is Plan 5.
- Visual styling: this plan uses Tailwind utility classes that approximate the mockups. Pixel-perfect parity with the brainstorm mockups (rounded card-shape table, opponents-as-fanned-backs, etc.) lands in Plan 3 when the in-game table view is built.
