# UI/UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Black Queen game UI with comfortable card sizing, vertical opponent fans, deal-out and trick-collection animations, hover lift with dim-illegal affordance, a fixed-height bid panel, and minimal sound foley — all anchored to the cozy card room visual direction.

**Architecture:** Layout changes are CSS/component-shape only. All motion is implemented with `framer-motion` (`motion.div`, `layoutId` for FLIP, `AnimatePresence` for entry/exit). Sound is implemented as a Howler singleton (`src/client/sounds.ts`) gated by a new `muted` state in the Zustand store, persisted in `localStorage`. No gameplay logic changes; the game engine, server, and shared types are untouched. A single feature branch off `main`.

**Tech Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind 3 · Zustand 4 · Socket.IO 4 · **framer-motion** (new) · **howler** (new). Vitest + Playwright for tests.

**Spec:** [`docs/superpowers/specs/2026-05-13-ui-ux-polish-design.md`](../specs/2026-05-13-ui-ux-polish-design.md).

---

## File Structure

```
src/
  client/
    sounds.ts                            (new)
    store.ts                             (modify — add muted state)
  components/
    Card.tsx                             (modify — add 'xl' size, dim prop)
    MuteToggle.tsx                       (new)
    bidding/
      BidPanel.tsx                       (modify — fixed-height layout)
    play/
      CardBack.tsx                       (modify — add 'md' + 'lg' sizes)
      DealAnimation.tsx                  (new)
      OpponentFan.tsx                    (modify — split into Horizontal + Vertical)
      PlayedCardsCenter.tsx              (modify — fixed slots + winning pulse + collect)
      PlayerHand.tsx                     (modify — bigger geometry + framer-motion)
    views/
      BiddingView.tsx                    (modify — mount DealAnimation + MuteToggle)
      EndView.tsx                        (modify — mount MuteToggle)
      TrickPlayView.tsx                  (modify — wrap LayoutGroup + MuteToggle)
      TrumpPartnerView.tsx               (modify — mount MuteToggle)
public/
  sounds/
    shuffle.mp3                          (new asset — placeholder silent)
    whip.mp3                             (new asset — placeholder silent)
    thump.mp3                            (new asset — placeholder silent)
    sweep.mp3                            (new asset — placeholder silent)
    ATTRIBUTION.md                       (new)
tailwind.config.ts                       (modify — cozy tokens)
tests/
  unit/
    sounds.test.ts                       (new)
    store.muted.test.ts                  (new)
  e2e/
    polish.spec.ts                       (new)
package.json                             (modify — add deps)
```

Each task below is self-contained and ends with a commit. Tasks are ordered so the app remains runnable between any two commits (a checkpoint can be reviewed at any task boundary).

---

## Task 1: Create branch and install dependencies

**Files:**
- Modify: `package.json` (add `framer-motion`, `howler`, `@types/howler`)

- [ ] **Step 1: Create feature branch from main**

```bash
git checkout main
git pull --ff-only 2>/dev/null || true
git checkout -b feat/ui-polish
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install framer-motion@^11.18.0 howler@^2.2.4
```

- [ ] **Step 3: Install dev type stubs for howler**

```bash
npm install --save-dev @types/howler@^2.2.11
```

- [ ] **Step 4: Verify installs succeeded**

```bash
node -e "console.log(require('framer-motion/package.json').version); console.log(require('howler/package.json').version);"
```
Expected: prints two version strings (e.g. `11.18.x` then `2.2.x`).

- [ ] **Step 5: Run existing checks to confirm we did not break anything**

```bash
npm run lint && npm run typecheck && npm test -- --run
```
Expected: lint clean, typecheck clean, 103 unit tests pass.

- [ ] **Step 6: Commit**

Draft commit message (show to user, wait for approval):
```
Add framer-motion and howler for UI polish

Pulls in framer-motion (^11.18) for FLIP-style layout transitions
and howler (^2.2) for sound playback with master mute. @types/howler
added as a dev dep. No code changes yet.
```

```bash
git add package.json package-lock.json
git commit -m "Add framer-motion and howler for UI polish"
```

---

## Task 2: Add cozy shadow and ease tokens to Tailwind

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace `tailwind.config.ts` with the extended theme**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: { 900: '#073322', 800: '#115540', 700: '#1f6b50' },
        gold: { 400: '#ffd455', 500: '#f4c842', 600: '#d4a830' },
        cardred: '#c52a2a',
        cardblack: '#1d1d1f',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        'card-rest': '0 4px 8px rgba(0,0,0,0.4)',
        'card-hover': '0 12px 24px rgba(0,0,0,0.55)',
        'card-glow-gold': '0 0 18px 4px #d4a437',
      },
      transitionTimingFunction: {
        'cozy': 'cubic-bezier(.2,.7,.2,1)',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Verify Tailwind classes compile**

```bash
npm run lint
```
Expected: no errors. (Tailwind validates class names at build, not lint; this is a smoke check.)

- [ ] **Step 3: Commit**

Draft commit message:
```
Add cozy shadow and ease tokens to Tailwind theme

shadow-card-rest / hover / glow-gold and ease-cozy curve used by
the polished card components.
```

```bash
git add tailwind.config.ts
git commit -m "Add cozy shadow and ease tokens to Tailwind theme"
```

---

## Task 3: Card — add `xl` size, expose dim and lift props

**Files:**
- Modify: `src/components/Card.tsx`

- [ ] **Step 1: Replace the Card component**

```tsx
import type { Card as CardType } from '@/shared/types';

interface CardProps {
  card: CardType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** True when this card is illegal on the current turn and must be visually dimmed. */
  dim?: boolean;
}

const SUIT_GLYPH: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

// xl is the "comfortable" player-hand size from the spec (88 × 124 ≈ w-22 h-31 -> w-[88px] h-[124px]).
// lg is the new center-played slot (80 × 112).
// md and sm are kept for HandPreview and small contexts.
const SIZE_CLASSES: Record<NonNullable<CardProps['size']>, { w: string; h: string; rank: string; suit: string; center: string }> = {
  sm: { w: 'w-10',          h: 'h-14',         rank: 'text-xs',  suit: 'text-[10px]', center: 'text-xl' },
  md: { w: 'w-14',          h: 'h-20',         rank: 'text-sm',  suit: 'text-xs',     center: 'text-2xl' },
  lg: { w: 'w-20',          h: 'h-28',         rank: 'text-base',suit: 'text-sm',     center: 'text-3xl' },
  xl: { w: 'w-[88px]',      h: 'h-[124px]',    rank: 'text-lg',  suit: 'text-base',   center: 'text-4xl' },
};

export function Card({ card, size = 'md', dim = false }: CardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const colorClass = isRed ? 'text-cardred' : 'text-cardblack';
  const s = SIZE_CLASSES[size];
  const glyph = SUIT_GLYPH[card.suit];
  const dimClass = dim ? 'opacity-50' : '';

  return (
    <div
      className={`${s.w} ${s.h} bg-[#fafaf5] rounded-md shadow-card-rest relative font-serif select-none ${colorClass} ${dimClass}`}
    >
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

Two changes worth noting:
1. Background changed from `bg-white` to `bg-[#fafaf5]` (ivory tint per the cozy direction).
2. Shadow swapped from `shadow-md` to the new `shadow-card-rest` token (deeper, more diffuse).

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run lint && npm run typecheck
```
Expected: clean. Existing `<Card size="md">` callers remain valid because `md` is unchanged in dimensions.

- [ ] **Step 3: Run E2E playwright sanity (bidding flow at minimum)**

```bash
npm run test:e2e -- bidding.spec.ts
```
Expected: 3 tests pass. (The card visuals change but selectors used in the test do not.)

If the dev server isn't running yet, run `npm run dev` in another shell first or let `npm run test:e2e` auto-start.

- [ ] **Step 4: Commit**

Draft commit message:
```
Card: add xl size, ivory tint, dim prop, cozy shadow

xl is the new comfortable player-hand size (88×124). lg is the
center-played slot (80×112). The dim prop is used by the player
hand to fade illegal-to-play cards. Background tint shifted from
pure white to ivory and rest shadow swapped to the new cozy token.
```

```bash
git add src/components/Card.tsx
git commit -m "Card: add xl size, ivory tint, dim prop, cozy shadow"
```

---

## Task 4: CardBack — add `md` and `lg` sizes

**Files:**
- Modify: `src/components/play/CardBack.tsx`

- [ ] **Step 1: Read current CardBack to know the existing structure**

```bash
cat src/components/play/CardBack.tsx
```

- [ ] **Step 2: Replace the CardBack component with the expanded sizing**

```tsx
interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<CardBackProps['size']>, { w: string; h: string }> = {
  sm: { w: 'w-8',          h: 'h-12' },
  md: { w: 'w-[44px]',     h: 'h-[62px]' },    // opponent backs (spec)
  lg: { w: 'w-[88px]',     h: 'h-[124px]' },   // deck stack (spec)
};

export function CardBack({ size = 'sm' }: CardBackProps) {
  const s = SIZE_CLASSES[size];
  return (
    <div
      className={`${s.w} ${s.h} rounded-md shadow-card-rest border border-blue-700/60`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, #1e3a5f 0px, #1e3a5f 6px, #2c4870 6px, #2c4870 12px)',
      }}
    />
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 4: Commit**

Draft commit message:
```
CardBack: add md (opponent) and lg (deck) sizes

md is 44×62 (opponent fan backs from the spec). lg is 88×124
(deck stack at center for the deal-out animation). Existing sm
size unchanged.
```

```bash
git add src/components/play/CardBack.tsx
git commit -m "CardBack: add md (opponent) and lg (deck) sizes"
```

---

## Task 5: Store — add `muted` state with localStorage persistence

**Files:**
- Modify: `src/client/store.ts`
- Create: `tests/unit/store.muted.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/store.muted.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/client/store';

describe('store muted state', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
    useGameStore.setState({ muted: false });
  });

  test('defaults to false', () => {
    expect(useGameStore.getState().muted).toBe(false);
  });

  test('setMuted(true) updates state and writes to localStorage', () => {
    useGameStore.getState().setMuted(true);
    expect(useGameStore.getState().muted).toBe(true);
    expect(globalThis.localStorage?.getItem('bq:muted')).toBe('true');
  });

  test('setMuted(false) writes "false" to localStorage', () => {
    useGameStore.getState().setMuted(true);
    useGameStore.getState().setMuted(false);
    expect(useGameStore.getState().muted).toBe(false);
    expect(globalThis.localStorage?.getItem('bq:muted')).toBe('false');
  });
});
```

- [ ] **Step 2: Verify test fails**

```bash
npm test -- --run tests/unit/store.muted.test.ts
```
Expected: FAIL ("setMuted is not a function" or "muted is undefined").

- [ ] **Step 3: Extend the store**

```typescript
// src/client/store.ts
'use client';
import { create } from 'zustand';
import type { RoomView, Player, Card } from '@/shared/types';

const MUTED_KEY = 'bq:muted';

function loadMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export interface GameStore {
  sessionId: string | null;
  room: RoomView | null;
  yourHand: Card[];
  connected: boolean;
  muted: boolean;

  setSession(sessionId: string): void;
  setRoom(room: RoomView | null): void;
  setHand(hand: Card[]): void;
  setConnected(c: boolean): void;
  setMuted(muted: boolean): void;
  reset(): void;
}

export const useGameStore = create<GameStore>((set) => ({
  sessionId: null,
  room: null,
  yourHand: [],
  connected: false,
  muted: loadMuted(),
  setSession: (sessionId) => set({ sessionId }),
  setRoom: (room) => set({ room }),
  setHand: (yourHand) => set({ yourHand }),
  setConnected: (connected) => set({ connected }),
  setMuted: (muted) => {
    saveMuted(muted);
    set({ muted });
  },
  reset: () => set({ sessionId: null, room: null, yourHand: [] }),
}));

export function selectMe(state: GameStore): Player | null {
  if (!state.room || !state.sessionId) return null;
  return state.room.players.find((p) => p.id === state.sessionId) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- --run tests/unit/store.muted.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 5: Run full unit test suite to check nothing regressed**

```bash
npm test -- --run
```
Expected: 106 tests pass (103 prior + 3 new).

- [ ] **Step 6: Commit**

Draft commit message:
```
Store: add muted state with localStorage persistence

Adds muted: boolean to the Zustand store with setMuted() that
mirrors the value to localStorage under bq:muted. Loaded on
store init. SSR-safe (no-op when window is undefined).
```

```bash
git add src/client/store.ts tests/unit/store.muted.test.ts
git commit -m "Store: add muted state with localStorage persistence"
```

---

## Task 6: sounds.ts — Howler singleton respecting `muted`

**Files:**
- Create: `src/client/sounds.ts`
- Create: `tests/unit/sounds.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/sounds.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('howler', () => {
  const play = vi.fn();
  return {
    Howl: vi.fn().mockImplementation(() => ({ play })),
    __mockPlay: play,
  };
});

import { useGameStore } from '@/client/store';
import { playSound, preloadSounds } from '@/client/sounds';
import * as howler from 'howler';

const mockedPlay = (howler as unknown as { __mockPlay: ReturnType<typeof vi.fn> }).__mockPlay;

describe('sounds module', () => {
  beforeEach(() => {
    mockedPlay.mockClear();
    useGameStore.setState({ muted: false });
    preloadSounds();
  });

  test('playSound triggers Howl.play() when not muted', () => {
    playSound('thump');
    expect(mockedPlay).toHaveBeenCalledTimes(1);
  });

  test('playSound is a no-op when muted', () => {
    useGameStore.setState({ muted: true });
    playSound('thump');
    expect(mockedPlay).not.toHaveBeenCalled();
  });

  test('unknown sound name is a no-op (does not throw)', () => {
    expect(() => playSound('nonsense' as never)).not.toThrow();
    expect(mockedPlay).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify test fails**

```bash
npm test -- --run tests/unit/sounds.test.ts
```
Expected: FAIL (`sounds` module missing).

- [ ] **Step 3: Create the sounds module**

```typescript
// src/client/sounds.ts
'use client';
import { Howl } from 'howler';
import { useGameStore } from '@/client/store';

export type SoundName = 'shuffle' | 'whip' | 'thump' | 'sweep';

const VOLUME: Record<SoundName, number> = {
  shuffle: 0.5,
  whip: 0.25,
  thump: 0.45,
  sweep: 0.4,
};

const FILES: Record<SoundName, string> = {
  shuffle: '/sounds/shuffle.mp3',
  whip: '/sounds/whip.mp3',
  thump: '/sounds/thump.mp3',
  sweep: '/sounds/sweep.mp3',
};

let pool: Record<SoundName, Howl> | null = null;

export function preloadSounds() {
  if (pool) return;
  pool = {
    shuffle: new Howl({ src: [FILES.shuffle], volume: VOLUME.shuffle, preload: true }),
    whip: new Howl({ src: [FILES.whip], volume: VOLUME.whip, preload: true }),
    thump: new Howl({ src: [FILES.thump], volume: VOLUME.thump, preload: true }),
    sweep: new Howl({ src: [FILES.sweep], volume: VOLUME.sweep, preload: true }),
  };
}

export function playSound(name: SoundName) {
  if (useGameStore.getState().muted) return;
  if (!pool) preloadSounds();
  const h = pool && pool[name];
  if (!h) return;
  try {
    h.play();
  } catch {
    /* ignore audio playback errors */
  }
}
```

- [ ] **Step 4: Run sounds tests**

```bash
npm test -- --run tests/unit/sounds.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm test -- --run
```
Expected: 109 unit tests pass.

- [ ] **Step 6: Commit**

Draft commit message:
```
Add sounds singleton with mute gate

src/client/sounds.ts exposes preloadSounds() and playSound(name)
backed by a Howler pool of 4 named clips (shuffle, whip, thump,
sweep). playSound is a no-op when the store's muted state is true.
Volumes are pre-balanced to cap below 0.5 of max.
```

```bash
git add src/client/sounds.ts tests/unit/sounds.test.ts
git commit -m "Add sounds singleton with mute gate"
```

---

## Task 7: Audio asset placeholders + attribution stub

**Files:**
- Create: `public/sounds/shuffle.mp3`
- Create: `public/sounds/whip.mp3`
- Create: `public/sounds/thump.mp3`
- Create: `public/sounds/sweep.mp3`
- Create: `public/sounds/ATTRIBUTION.md`

Howler logs a warning (not an error) if an MP3 file is missing. To keep the dev experience clean and the audio pipeline wired end-to-end without blocking on asset curation, we ship 4 zero-byte stubs. Real CC0 / CC-BY clips can be dropped in later without touching code.

- [ ] **Step 1: Create the sounds directory and empty MP3 stubs**

```bash
mkdir -p public/sounds
: > public/sounds/shuffle.mp3
: > public/sounds/whip.mp3
: > public/sounds/thump.mp3
: > public/sounds/sweep.mp3
```

- [ ] **Step 2: Write the attribution / curation note**

```markdown
# Audio Attribution

The 4 audio files in this directory ship as zero-byte placeholders
so the audio pipeline is wired end-to-end without blocking on
curation. To enable real sounds, replace each file with a small
(<40 KB) CC0 or CC-BY clip from freesound.org or similar.

Suggested searches (CC0 preferred):

| File         | Suggested search                                       | Notes                                |
|--------------|--------------------------------------------------------|--------------------------------------|
| shuffle.mp3  | "card shuffle short"                                   | ~600 ms, fires once before deal-out  |
| whip.mp3     | "card flick" or "card whoosh short"                    | <120 ms, plays ~52× during deal      |
| thump.mp3    | "card on table" or "card flop felt"                    | <100 ms, fires on every card play    |
| sweep.mp3    | "card sweep" or "cards scoop"                          | ~400 ms, fires once per trick collect|

If a clip is CC-BY, add a line below following the format
"<file> — <author> — <source URL>". CC0 clips need no attribution.

## Volumes

Pre-balanced in `src/client/sounds.ts`. Loudest sound caps at 0.5
of linear maximum. If your replacement clips are louder than the
placeholders would have been, adjust the VOLUME table there.

## Attributions

(none yet — currently shipping silent placeholders)
```

- [ ] **Step 3: Verify file sizes are zero (silent stubs)**

```bash
ls -la public/sounds/
```
Expected: shuffle/whip/thump/sweep.mp3 all 0 bytes; ATTRIBUTION.md is non-zero.

- [ ] **Step 4: Commit**

Draft commit message:
```
Add audio asset placeholders and attribution doc

Ships 4 zero-byte MP3 stubs (shuffle, whip, thump, sweep) so the
audio pipeline is wired end-to-end without blocking on curation.
ATTRIBUTION.md documents the suggested freesound.org searches to
replace each placeholder with a real clip.
```

```bash
git add public/sounds/
git commit -m "Add audio asset placeholders and attribution doc"
```

---

## Task 8: MuteToggle component

**Files:**
- Create: `src/components/MuteToggle.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/MuteToggle.tsx
'use client';
import { useGameStore } from '@/client/store';

export function MuteToggle() {
  const muted = useGameStore((s) => s.muted);
  const setMuted = useGameStore((s) => s.setMuted);

  return (
    <button
      type="button"
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      aria-pressed={muted}
      onClick={() => setMuted(!muted)}
      className="fixed top-3 right-3 z-50 w-9 h-9 rounded-full bg-felt-800/80 border border-gold-500/30 text-white hover:bg-felt-700 transition-colors flex items-center justify-center text-base"
      data-testid="mute-toggle"
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run lint && npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit**

Draft commit message:
```
Add MuteToggle component

Top-right fixed button that toggles store muted state. ARIA-labelled
and aria-pressed reflects current state. data-testid="mute-toggle"
for E2E testing.
```

```bash
git add src/components/MuteToggle.tsx
git commit -m "Add MuteToggle component"
```

---

## Task 9: Mount MuteToggle in every in-room view

**Files:**
- Modify: `src/components/views/BiddingView.tsx`
- Modify: `src/components/views/TrumpPartnerView.tsx`
- Modify: `src/components/views/TrickPlayView.tsx`
- Modify: `src/components/views/EndView.tsx`

For each of the four files below: add `import { MuteToggle } from '@/components/MuteToggle';` near the top of the import block, and add `<MuteToggle />` as the first child inside the top-level `<main>` element.

- [ ] **Step 1: Modify `BiddingView.tsx`**

After the existing imports add:
```tsx
import { MuteToggle } from '@/components/MuteToggle';
```

Inside the JSX, immediately after the opening `<main ...>`:
```tsx
<MuteToggle />
```

- [ ] **Step 2: Modify `TrumpPartnerView.tsx`**

Same edit pattern: add import + first child of `<main>`.

- [ ] **Step 3: Modify `TrickPlayView.tsx`**

Same edit pattern: add import + first child of `<main>`.

- [ ] **Step 4: Modify `EndView.tsx`**

Same edit pattern: add import + first child of `<main>`.

- [ ] **Step 5: Verify lint, typecheck, unit tests, and a quick E2E smoke**

```bash
npm run lint && npm run typecheck && npm test -- --run
npm run test:e2e -- lobby.spec.ts
```
Expected: lint clean, typecheck clean, 109 unit tests pass, lobby E2E passes.

- [ ] **Step 6: Commit**

Draft commit message:
```
Mount MuteToggle in all in-room views

BiddingView, TrumpPartnerView, TrickPlayView, EndView all now show
the fixed top-right mute toggle.
```

```bash
git add src/components/views/BiddingView.tsx src/components/views/TrumpPartnerView.tsx src/components/views/TrickPlayView.tsx src/components/views/EndView.tsx
git commit -m "Mount MuteToggle in all in-room views"
```

---

## Task 10: BidPanel — fixed-height restructure

**Files:**
- Modify: `src/components/bidding/BidPanel.tsx`

- [ ] **Step 1: Replace BidPanel with the fixed-height layout**

```tsx
// src/components/bidding/BidPanel.tsx
'use client';
import type { BidState, Seat } from '@/shared/types';
import { MIN_BID, MAX_BID, BID_INCREMENT } from '@/shared/types';

interface BidPanelProps {
  bid: BidState;
  yourSeat: Seat;
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
    <div
      data-testid="bid-panel"
      className="w-[360px] h-[290px] mx-auto bg-felt-900/95 border border-gold-500/40 rounded-2xl p-5 shadow-2xl flex flex-col"
    >
      {/* Header: status + meta. Fixed height. */}
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] uppercase tracking-widest text-gold-500 font-bold">● Bidding</span>
        <span className="text-[10px] text-neutral-500">no timer · waits for passes</span>
      </div>

      {/* Current bid display. Fixed height of 60px regardless of state. */}
      <div className="text-center h-[60px] flex flex-col justify-center">
        {bid.currentBid === null ? (
          <>
            <div className="text-4xl font-bold text-gold-500 leading-none">—</div>
            <div className="text-xs text-neutral-400 mt-1">no bid yet · floor {MIN_BID}</div>
          </>
        ) : (
          <>
            <div className="text-4xl font-bold text-gold-500 leading-none">{bid.currentBid}</div>
            <div className="text-xs text-neutral-300 mt-1">
              held by <b className={isCurrentBidder ? 'text-gold-500' : 'text-white'}>seat {bid.currentBidderSeat}</b>
            </div>
          </>
        )}
      </div>

      {/* Quick-bid grid: always 2×4 (or shorter if MAX_BID is close). Fixed height. */}
      <div className={`grid grid-cols-4 grid-rows-2 gap-2 mt-2 ${youPassed ? 'opacity-30 pointer-events-none' : ''}`}>
        {Array.from({ length: 8 }).map((_, i) => {
          const amt = visibleAmounts[i];
          if (amt === undefined) {
            // Reserve slot for layout stability when fewer than 8 bids remain.
            return <div key={`empty-${i}`} className="h-9" />;
          }
          const delta = bid.currentBid === null ? null : amt - bid.currentBid;
          return (
            <button
              key={amt}
              type="button"
              disabled={busy}
              onClick={() => onBid(amt)}
              className="bg-gradient-to-b from-felt-700 to-felt-800 hover:from-felt-800 hover:to-felt-900 hover:border-gold-500 border border-gold-500/25 text-white text-sm font-bold rounded-lg h-9 disabled:opacity-50"
            >
              {delta !== null && <span className="block text-[9px] text-gold-500 font-medium leading-none">+{delta}</span>}
              {amt}
            </button>
          );
        })}
      </div>

      {/* Pass row: fixed height reserved either way. */}
      <div className="mt-2 h-9">
        {bid.currentBid !== null && !isCurrentBidder ? (
          <button
            type="button"
            disabled={busy || youPassed}
            onClick={onPass}
            className="w-full h-full bg-white/5 hover:bg-red-400/15 hover:border-red-400 border border-white/15 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {youPassed ? 'Passed' : `Pass at ${bid.currentBid}`}
          </button>
        ) : null}
      </div>

      {youPassed && (
        <div className="text-center text-[11px] text-gold-500 mt-1">You passed. Waiting for others.</div>
      )}
    </div>
  );
}
```

Critical change: the container is now `h-[290px]` (fixed) and contents are flex-laid into reserved sections. Empty grid cells render as invisible spacers so the grid stays 2×4 even when MAX_BID is near. The pass-button row is always reserved; the button itself only renders when applicable. Total height never changes once a bid is placed — eliminating the original overflow bug.

- [ ] **Step 2: Run existing bidding E2E**

```bash
npm run test:e2e -- bidding.spec.ts
```
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

Draft commit message:
```
BidPanel: fixed-height layout (overflow fix)

Container is locked at h-[290px]. Header, current-bid display,
quick-bid grid, and pass row all have reserved heights. Empty
grid cells render as spacers when MAX_BID approaches. The panel
no longer grows when a bid is placed — fixing the original
top-of-viewport clipping issue.
```

```bash
git add src/components/bidding/BidPanel.tsx
git commit -m "BidPanel: fixed-height layout (overflow fix)"
```

---

## Task 11: OpponentFan — split into Horizontal and Vertical variants

**Files:**
- Modify: `src/components/play/OpponentFan.tsx`

The current implementation renders left/right opponents as a column of marginTop-offset rotated cards — they end up as a vertical stack of horizontal rectangles rather than a true vertical fan. This task fixes that by using absolute positioning so cards can overlap and angle around a virtual focal point off-screen, matching the geometry from the design spec.

- [ ] **Step 1: Replace OpponentFan with the split implementation**

```tsx
// src/components/play/OpponentFan.tsx
import { CardBack } from './CardBack';

interface Props {
  count: number;
  orientation: 'top' | 'left' | 'right';
}

export function OpponentFan({ count, orientation }: Props) {
  if (count <= 0) return null;

  if (orientation === 'top') {
    return <OpponentFanHorizontal count={count} />;
  }
  return <OpponentFanVertical count={count} side={orientation} />;
}

function OpponentFanHorizontal({ count }: { count: number }) {
  const cards = Array.from({ length: count });
  const maxRot = 11;                                  // ~22° total spread
  const step = count > 1 ? (maxRot * 2) / (count - 1) : 0;
  return (
    <div className="relative w-[260px] h-[80px]" data-testid="opponent-fan-top">
      {cards.map((_, i) => {
        const rot = -maxRot + step * i;
        const offsetX = (i - (count - 1) / 2) * 12;   // overlap step
        return (
          <div
            key={i}
            className="absolute left-1/2 top-0"
            style={{
              transform: `translateX(${offsetX - 22}px) rotate(${rot}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <CardBack size="md" />
          </div>
        );
      })}
    </div>
  );
}

function OpponentFanVertical({ count, side }: { count: number; side: 'left' | 'right' }) {
  const cards = Array.from({ length: count });
  const maxRot = 11;                                  // ~22° spread
  const step = count > 1 ? (maxRot * 2) / (count - 1) : 0;
  // baseRot rotates the whole card 90° so its long edge runs vertical.
  // Then per-card delta bows outward (positive on right side, negative on left).
  const baseRot = side === 'left' ? 90 : -90;
  const direction = side === 'left' ? 1 : -1;
  return (
    <div
      className="relative w-[80px] h-[260px]"
      data-testid={`opponent-fan-${side}`}
    >
      {cards.map((_, i) => {
        const delta = -maxRot + step * i;
        const rot = baseRot + delta * direction;
        const offsetY = (i - (count - 1) / 2) * 12;   // overlap step along the side
        return (
          <div
            key={i}
            className="absolute left-0 top-1/2"
            style={{
              transform: `translateY(${offsetY - 31}px) rotate(${rot}deg)`,
              transformOrigin: side === 'left' ? 'left center' : 'right center',
            }}
          >
            <CardBack size="md" />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run lint && npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Run E2E smoke (play.spec.ts touches the play view)**

```bash
npm run test:e2e -- play.spec.ts
```
Expected: passes (selectors are unchanged).

- [ ] **Step 4: Commit**

Draft commit message:
```
OpponentFan: split into Horizontal and Vertical variants

Vertical (left/right opponents) now uses absolute positioning with
a 22° bowed-outward fan rotated 90°, instead of the previous stack
of horizontal rectangles. Card backs bumped from sm to md size
(44×62) to match the comfortable-scale spec.
```

```bash
git add src/components/play/OpponentFan.tsx
git commit -m "OpponentFan: split into Horizontal and Vertical variants"
```

---

## Task 12: PlayerHand — bigger geometry, framer-motion hover lift, dim-illegal

**Files:**
- Modify: `src/components/play/PlayerHand.tsx`

This task ports the player hand to use the `xl` Card size, bigger fan radius, framer-motion for the hover lift (so it composes cleanly with the layout transitions later), and a clearer dim-illegal treatment. The existing two-click stage-then-play UX is kept: first click lifts the card +60px (the "staged" state), second click commits (which will later trigger the arc-to-center).

- [ ] **Step 1: Replace PlayerHand**

```tsx
// src/components/play/PlayerHand.tsx
'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/Card';
import type { Card as CardType } from '@/shared/types';
import { cardKey } from '@/shared/types';

interface Props {
  hand: CardType[];
  legalKeys: Set<string> | null;
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
  const maxRot = 18;                       // ~36° total spread
  const step = n > 1 ? (maxRot * 2) / (n - 1) : 0;
  const overlap = 38;                      // px overlap between adjacent cards

  function handleClick(card: CardType) {
    if (!active) return;
    const k = cardKey(card);
    if (legalKeys && !legalKeys.has(k)) return;
    if (stagedKey === k) {
      onPlay(card);
      setStagedKey(null);
      return;
    }
    setStagedKey(k);
  }

  return (
    <div className="relative h-44">
      <div className="flex justify-center items-end h-full">
        {sorted.map((card, i) => {
          const k = cardKey(card);
          const rot = -maxRot + step * i;
          const isStaged = stagedKey === k;
          const isLegal = !legalKeys || legalKeys.has(k);
          const dim = active && !isLegal;
          const isHoverable = active && isLegal;

          return (
            <motion.div
              key={k}
              layoutId={`card-${k}`}
              onClick={() => handleClick(card)}
              className={`${isHoverable ? 'cursor-pointer' : ''} ${dim ? 'cursor-not-allowed' : ''}`}
              style={{
                marginLeft: i === 0 ? 0 : `-${overlap}px`,
                zIndex: isStaged ? 50 : i,
                transformOrigin: 'bottom center',
              }}
              initial={false}
              animate={{
                rotate: rot,
                y: isStaged ? -60 : 0,
                scale: isStaged ? 1.05 : 1,
              }}
              whileHover={isHoverable && !isStaged ? { y: -12 } : undefined}
              transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <Card card={card} size="xl" dim={dim} />
            </motion.div>
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

Notes:
- `layoutId={'card-' + k}` opts each card into framer-motion's shared-layout animation. When PlayedCardsCenter renders a `<motion.div layoutId="card-{k}">` for the same key, framer will smoothly tween between hand position and center position.
- The hand container grew from `h-32` to `h-44` to accommodate the bigger `xl` size and the higher staged-lift (60px instead of 32px).
- `overlap` is the key knob for fan density; 38px is the spec value for the comfortable scale.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: clean. (framer-motion's types pick up `layoutId`, `animate`, `whileHover`, `transition` props.)

- [ ] **Step 3: Run play E2E**

```bash
npm run test:e2e -- play.spec.ts
```
Expected: passes.

If the play test fails on a "card too small to click" issue, it likely needs to wait for the framer-motion layout animation before clicking. Note for the engineer: if a Playwright selector breaks, prefer adding `data-testid` markers over inflating delays.

- [ ] **Step 4: Commit**

Draft commit message:
```
PlayerHand: xl card size, bigger fan, framer-motion hover and stage

Hand cards switch from md (56×80) to xl (88×124). Fan spread
opens to ~36° with 38 px overlap. Hover lift is now driven by
framer-motion (y: -12) instead of Tailwind hover:-translate-y-3,
which lets the lift compose cleanly with later layout transitions.
layoutId="card-{k}" is set so each card can share its identity
across hand → center moves in a follow-up task.
```

```bash
git add src/components/play/PlayerHand.tsx
git commit -m "PlayerHand: xl card size, bigger fan, framer-motion hover and stage"
```

---

## Task 13: PlayedCardsCenter — fixed seat slots, motion-ready card identity

**Files:**
- Modify: `src/components/play/PlayedCardsCenter.tsx`

This task wires each played card to a stable per-seat slot (so it always lands at the correct N/E/S/W offset relative to the viewer) and gives each card the matching `layoutId` so framer-motion handles the hand → center transition automatically once a player clicks-to-play.

- [ ] **Step 1: Replace PlayedCardsCenter**

```tsx
// src/components/play/PlayedCardsCenter.tsx
'use client';
import { motion } from 'framer-motion';
import { Card } from '@/components/Card';
import { cardKey } from '@/shared/types';
import type { PlayedCard, Seat } from '@/shared/types';

interface Props {
  plays: PlayedCard[];
  viewerSeat: Seat;
  /** When set, the card from this seat is currently the winner and pulses gold. */
  winningSeat?: Seat | null;
}

function positionFor(viewerSeat: Seat, seat: Seat): 'top' | 'left' | 'right' | 'bottom' {
  const diff = (seat - viewerSeat + 4) % 4;
  if (diff === 0) return 'bottom';
  if (diff === 1) return 'left';
  if (diff === 2) return 'top';
  return 'right';
}

const POSITION_STYLE: Record<string, React.CSSProperties> = {
  top:    { top: 0,    left: '50%', transform: 'translateX(-50%)' },
  left:   { left: 0,   top: '50%',  transform: 'translateY(-50%)' },
  right:  { right: 0,  top: '50%',  transform: 'translateY(-50%)' },
  bottom: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
};

export function PlayedCardsCenter({ plays, viewerSeat, winningSeat = null }: Props) {
  return (
    <div className="relative w-[240px] h-[240px] mx-auto" data-testid="played-cards">
      {plays.map(({ seat, card }) => {
        const pos = positionFor(viewerSeat, seat);
        const isWinner = winningSeat === seat;
        return (
          <motion.div
            key={`${seat}-${cardKey(card)}`}
            layoutId={`card-${cardKey(card)}`}
            className="absolute"
            style={POSITION_STYLE[pos]}
            animate={
              isWinner
                ? {
                    scale: [1, 1.18, 1.05],
                    boxShadow: [
                      '0 4px 8px rgba(0,0,0,0.4)',
                      '0 0 18px 4px #d4a437',
                      '0 0 0px 0px rgba(212,164,55,0)',
                    ],
                  }
                : { scale: 1 }
            }
            transition={isWinner ? { duration: 0.4 } : { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            data-testid={`played-card-${pos}`}
          >
            <Card card={card} size="lg" />
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
npm run lint && npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Update TrickPlayView to wrap the play area in `<LayoutGroup>`**

In `src/components/views/TrickPlayView.tsx`, add a framer-motion import near the top:

```tsx
import { LayoutGroup } from 'framer-motion';
```

Then wrap the main play-area block (the `<div className="relative max-w-4xl mx-auto mt-6 h-[380px]">` plus the player-hand block beneath it) in `<LayoutGroup>...</LayoutGroup>`. Concretely, change:

```tsx
      <div className="relative max-w-4xl mx-auto mt-6 h-[380px]">
        ...
      </div>

      <div className="max-w-4xl mx-auto mt-4">
        ...
      </div>
```

to:

```tsx
      <LayoutGroup>
        <div className="relative max-w-4xl mx-auto mt-6 h-[380px]">
          ...
        </div>

        <div className="max-w-4xl mx-auto mt-4">
          ...
        </div>
      </LayoutGroup>
```

`LayoutGroup` is what makes shared-layoutId tweens span across the two containers (hand and center).

- [ ] **Step 4: Run E2E**

```bash
npm run test:e2e -- play.spec.ts
```
Expected: passes.

- [ ] **Step 5: Commit**

Draft commit message:
```
PlayedCardsCenter: motion identity + winner pulse + LayoutGroup

Each played card now uses motion.div with layoutId="card-{k}"
matching the PlayerHand, so framer-motion smoothly animates the
hand → center transition when a card is played. The winning seat's
card animates a gold pulse (scale + glow over 400 ms). TrickPlayView
wraps the play-area + hand in <LayoutGroup> so the shared identity
spans both containers. Center area expanded from 180 to 240 px to
accommodate the larger lg-size played cards.
```

```bash
git add src/components/play/PlayedCardsCenter.tsx src/components/views/TrickPlayView.tsx
git commit -m "PlayedCardsCenter: motion identity + winner pulse + LayoutGroup"
```

---

## Task 14: Trick collection — winning-card pulse then group-pile sweep

**Files:**
- Modify: `src/components/views/TrickPlayView.tsx`

The server already includes `winnerSeat` on each `currentTrick` when it completes. When the trick has 4 plays and a winner, hold the trick visible for ~700 ms (read pause), pulse the winning card for ~400 ms, then animate all 4 cards as a group toward the winning seat over ~500 ms, fading to 0.

We implement this as a small state machine inside `TrickPlayView` driven by `useEffect`:
- `idle` — no trick or trick has <4 plays. Just render normally.
- `pause` — trick has 4 plays, winner present. Hold 700 ms.
- `pulse` — pass winningSeat to PlayedCardsCenter so its winner card animates the gold pulse. Hold 400 ms.
- `collect` — animate all played cards' position to the winning seat's screen coordinate, fade to 0. Hold 500 ms.
- After collect ends, server will have advanced the state and `currentTrick` will be the next trick (or `null` and phase=`end`). The state machine resets to `idle`.

- [ ] **Step 1: Add a helper that resolves a seat's screen-space coordinate**

In `src/components/views/TrickPlayView.tsx`, after the existing `rotate` helper, add:

```tsx
function seatScreenOffset(viewerSeat: Seat, seat: Seat): { x: number; y: number } {
  const diff = (seat - viewerSeat + 4) % 4;
  // Approximate offsets in pixels from the center of the play area to the
  // center of each seat's fan. Numbers tuned to match the play-area's
  // 380 px height / max-w-4xl width on common viewports.
  if (diff === 0) return { x: 0, y: 280 };   // bottom (you) — used for animations only
  if (diff === 1) return { x: -360, y: 0 };  // left
  if (diff === 2) return { x: 0, y: -180 };  // top
  return { x: 360, y: 0 };                   // right
}
```

- [ ] **Step 2: Add the trick state-machine inside the component**

Inside `TrickPlayView` (after computing `trick` and `nextSeat`, before the return JSX), add:

```tsx
const [collectPhase, setCollectPhase] = useState<'idle' | 'pause' | 'pulse' | 'collect'>('idle');
const completedAt = useRef<string | null>(null);
const trickKey = trick ? `${trick.ledBy}-${trick.plays.length}` : 'none';

useEffect(() => {
  if (!trick || trick.plays.length < 4 || trick.winnerSeat === undefined || trick.winnerSeat === null) {
    if (collectPhase !== 'idle') setCollectPhase('idle');
    return;
  }
  if (completedAt.current === trickKey) return;     // already running for this trick
  completedAt.current = trickKey;
  setCollectPhase('pause');
  const t1 = setTimeout(() => setCollectPhase('pulse'), 700);
  const t2 = setTimeout(() => setCollectPhase('collect'), 700 + 400);
  // collect phase ends when server advances state; we just leave it.
  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
}, [trick, trickKey, collectPhase]);
```

Add the missing imports at the top of the file:

```tsx
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 3: Render the collect motion on top of the existing center**

Replace the `<PlayedCardsCenter ...>` call with a wrapper that picks behavior based on `collectPhase`:

```tsx
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
  {trick && collectPhase !== 'collect' && (
    <PlayedCardsCenter
      plays={trick.plays}
      viewerSeat={me.seat}
      winningSeat={collectPhase === 'pulse' ? (trick.winnerSeat as Seat) : null}
    />
  )}
  {trick && collectPhase === 'collect' && trick.winnerSeat && (
    <CollectingPile plays={trick.plays} viewerSeat={me.seat} winnerSeat={trick.winnerSeat as Seat} />
  )}
</div>
```

- [ ] **Step 4: Add the CollectingPile component inline in the same file**

Below `seatScreenOffset`, add:

```tsx
function CollectingPile({
  plays,
  viewerSeat,
  winnerSeat,
}: {
  plays: NonNullable<RoomView['game']>['currentTrick']['plays'];
  viewerSeat: Seat;
  winnerSeat: Seat;
}) {
  const target = seatScreenOffset(viewerSeat, winnerSeat);
  return (
    <div className="relative w-[240px] h-[240px] mx-auto" data-testid="collecting-pile">
      {plays.map(({ card }, i) => (
        <motion.div
          key={`collect-${cardKey(card)}`}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: target.x, y: target.y, opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1], delay: i * 0.02 }}
        >
          <Card card={card} size="lg" />
        </motion.div>
      ))}
    </div>
  );
}
```

Add the framer-motion import at the top:

```tsx
import { motion } from 'framer-motion';
```

Add `Card` and `cardKey` imports (Card is in `@/components/Card`, cardKey in `@/shared/types` — should already be imported).

- [ ] **Step 5: Verify lint, typecheck**

```bash
npm run lint && npm run typecheck
```
Expected: clean.

- [ ] **Step 6: Run play E2E**

```bash
npm run test:e2e -- play.spec.ts
```
Expected: passes. The collection animation runs in the background of any further actions; Playwright doesn't need to wait for it explicitly because the next trick starts only after the server advances state.

- [ ] **Step 7: Commit**

Draft commit message:
```
Trick collection: pause → pulse → group-pile sweep to winner

Adds a small client-side state machine to TrickPlayView that holds
the 4-card trick visible for 700 ms, pulses the winning card with
a gold glow for 400 ms, then animates all 4 cards as a group toward
the winner's seat offset over 500 ms with a fade-out. The server
remains the source of truth for advancing trick state.
```

```bash
git add src/components/views/TrickPlayView.tsx
git commit -m "Trick collection: pause → pulse → group-pile sweep to winner"
```

---

## Task 15: DealAnimation — clockwise deal-out overlay

**Files:**
- Create: `src/components/play/DealAnimation.tsx`

This overlay component renders once when the phase transitions from `lobby` → `bidding`. It draws a deck stack at the center, then over ~2.1s flicks 52 cards one at a time to N → E → S → W → … in seat order. After all cards land, your-hand flips face-up in a left-to-right ripple. Then it calls `onDone()`. `BiddingView` will gate its main content behind this overlay.

- [ ] **Step 1: Create the DealAnimation component**

```tsx
// src/components/play/DealAnimation.tsx
'use client';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CardBack } from './CardBack';
import type { Seat } from '@/shared/types';

interface Props {
  viewerSeat: Seat;
  onDone: () => void;
}

/** Each entry: which seat receives card i, in deal order (0..51). N=top, E=right, S=bottom, W=left from viewer. */
function buildDealOrder(viewerSeat: Seat): Array<'top' | 'right' | 'bottom' | 'left'> {
  // Server-side deal in the engine deals to seats in 1→2→3→4→1… order.
  // We translate seat → viewer-relative position.
  function pos(seat: Seat): 'top' | 'right' | 'bottom' | 'left' {
    const diff = (seat - viewerSeat + 4) % 4;
    if (diff === 0) return 'bottom';
    if (diff === 1) return 'left';
    if (diff === 2) return 'top';
    return 'right';
  }
  const out: Array<'top' | 'right' | 'bottom' | 'left'> = [];
  for (let i = 0; i < 52; i++) {
    const seat = ((i % 4) + 1) as Seat;
    out.push(pos(seat));
  }
  return out;
}

const TARGET_OFFSET: Record<'top' | 'right' | 'bottom' | 'left', { x: number; y: number; rotate: number }> = {
  top:    { x: 0,    y: -180, rotate: 180 },
  right:  { x: 360,  y: 0,    rotate: -90 },
  bottom: { x: 0,    y: 180,  rotate: 0 },
  left:   { x: -360, y: 0,    rotate: 90 },
};

const PER_CARD_DELAY = 0.04;        // 40 ms — clockwise dealer cadence
const FLIGHT_DURATION = 0.32;       // each card's flight time
const TOTAL_DURATION_MS = 2100 + 600; // deal + flip ripple + small settle

export function DealAnimation({ viewerSeat, onDone }: Props) {
  const order = buildDealOrder(viewerSeat);

  useEffect(() => {
    const t = setTimeout(onDone, TOTAL_DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center"
      data-testid="deal-animation"
    >
      {/* Deck stack at center */}
      <div className="absolute" style={{ transform: 'translate(-2px,-2px)', opacity: 0.7 }}>
        <CardBack size="lg" />
      </div>
      <div className="absolute" style={{ transform: 'translate(0,0)', opacity: 0.85 }}>
        <CardBack size="lg" />
      </div>
      <div className="absolute" style={{ transform: 'translate(2px,2px)' }}>
        <CardBack size="lg" />
      </div>

      {/* 52 flying cards. Each starts at deck center and animates to a seat. */}
      {order.map((pos, i) => {
        const target = TARGET_OFFSET[pos];
        return (
          <motion.div
            key={i}
            className="absolute"
            initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
            animate={{
              x: target.x,
              y: target.y,
              rotate: target.rotate,
              opacity: [0, 1, 1, 1],
            }}
            transition={{
              delay: i * PER_CARD_DELAY,
              duration: FLIGHT_DURATION,
              ease: [0.2, 0.7, 0.2, 1],
              times: [0, 0.15, 0.85, 1],
            }}
          >
            <CardBack size="md" />
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit**

Draft commit message:
```
Add DealAnimation overlay component

Renders a deck-at-center and animates 52 face-down cards out to
the 4 seat positions at 40 ms intervals (clockwise dealer cadence)
over ~2.1 s. Calls onDone() after the total cycle (~2.7 s including
settle). Pointer-events-none so it doesn't block other UI while
running.
```

```bash
git add src/components/play/DealAnimation.tsx
git commit -m "Add DealAnimation overlay component"
```

---

## Task 16: Mount DealAnimation in BiddingView (only on lobby → bidding transition)

**Files:**
- Modify: `src/components/views/BiddingView.tsx`

We only want the deal-out to play the first time this client sees `phase=bidding` after `phase=lobby`. If a player reconnects mid-game and lands in bidding, the animation should not replay. We track this with a `useEffect` + a session-scoped flag passed by the parent.

Simpler approach: `BiddingView` itself tracks "have I played the deal animation since I mounted?" via a `useState` + `useEffect` watching the bid state. If at mount the bid already has any history (currentBid !== null or passedSeats.length > 0), we skip the animation. Otherwise we play it on first render.

- [ ] **Step 1: Modify BiddingView to mount the animation**

In `src/components/views/BiddingView.tsx`, add imports:

```tsx
import { useEffect, useState } from 'react';
import { DealAnimation } from '@/components/play/DealAnimation';
```

Inside the `BiddingView` component, at the top of the body:

```tsx
const bid = room.game?.bid;
const isFreshDeal = !!bid && bid.currentBid === null && bid.passedSeats.length === 0;
const [dealing, setDealing] = useState(isFreshDeal);

useEffect(() => {
  // Only auto-play on the initial mount if it's a fresh deal.
  if (!isFreshDeal) setDealing(false);
  // We intentionally only consider isFreshDeal at mount-time; mid-bidding
  // resumes after a reconnect should not re-trigger.
}, [isFreshDeal]);
```

In the returned JSX, render the overlay above the rest of the body when `dealing` is true:

```tsx
{dealing && <DealAnimation viewerSeat={me.seat} onDone={() => setDealing(false)} />}
```

The bid panel is already part of BiddingView's JSX. It will render underneath the animation overlay; the overlay uses `pointer-events-none` so clicks pass through, but visually it dominates. For a cleaner reveal you may optionally hide the bid panel content while `dealing` is true; if you do, use `style={{ visibility: dealing ? 'hidden' : 'visible' }}` on the panel's container (not `display: none`, which causes layout shift).

- [ ] **Step 2: Verify typecheck and unit tests**

```bash
npm run typecheck && npm test -- --run
```
Expected: clean.

- [ ] **Step 3: Run bidding E2E**

```bash
npm run test:e2e -- bidding.spec.ts
```
Expected: passes. The E2E test does `await expect(page.getByText(/Bidding phase/i)).toBeVisible()` which is still true while the animation runs. Subsequent bid-button clicks may need to wait an extra ~3 s — Playwright's default 5 s element-actionable timeout should cover this, but if a test flakes, the engineer can add `await page.waitForTimeout(2700)` after waiting for "Bidding phase" or — preferred — `await expect(page.getByTestId('deal-animation')).toHaveCount(0)`.

- [ ] **Step 4: Commit**

Draft commit message:
```
BiddingView: play DealAnimation on fresh deal

Mounts the deal-out overlay when the client enters bidding with
an untouched bid state (no current bid, no passes). On reconnects
mid-bidding the animation is skipped. The overlay clears itself
after onDone fires (~2.7 s after mount).
```

```bash
git add src/components/views/BiddingView.tsx
git commit -m "BiddingView: play DealAnimation on fresh deal"
```

---

## Task 17: Wire sounds to trigger points

**Files:**
- Modify: `src/components/play/DealAnimation.tsx` (shuffle + per-card whip)
- Modify: `src/components/views/TrickPlayView.tsx` (thump on each play, sweep on collect)
- Modify: `src/app/layout.tsx` (preload sounds once on first mount)

The trigger points are:
- **Shuffle** — once when DealAnimation mounts.
- **Whip** — once per card during the deal (~52 × at 40 ms intervals).
- **Thump** — when a new card appears in `currentTrick.plays` (any seat, including yours).
- **Sweep** — once when the collect-phase begins in TrickPlayView.

- [ ] **Step 1: Preload sounds in the root layout**

In `src/app/layout.tsx`, find the root component. Add at the top of the file:

```tsx
'use client';
import { useEffect } from 'react';
import { preloadSounds } from '@/client/sounds';
```

Wait — if `layout.tsx` is currently a server component (typical in Next.js App Router), we shouldn't add `'use client'` there. Instead, create a small client wrapper component:

Create `src/components/SoundsPreloader.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { preloadSounds } from '@/client/sounds';

export function SoundsPreloader() {
  useEffect(() => {
    preloadSounds();
  }, []);
  return null;
}
```

Then in `src/app/layout.tsx`, import it and render `<SoundsPreloader />` inside the body. If layout.tsx already returns `<html><body>{children}</body></html>` (or similar), add `<SoundsPreloader />` as a sibling of `{children}`. Don't switch the layout to a client component.

- [ ] **Step 2: Wire shuffle + whip into DealAnimation**

In `src/components/play/DealAnimation.tsx`, add:

```tsx
import { playSound } from '@/client/sounds';
```

Inside the existing `useEffect` (the one with `setTimeout(onDone, TOTAL_DURATION_MS)`), add the shuffle play before the timer and schedule whip plays alongside the card delays:

```tsx
useEffect(() => {
  playSound('shuffle');
  const whips: number[] = [];
  for (let i = 0; i < 52; i++) {
    whips.push(window.setTimeout(() => playSound('whip'), i * PER_CARD_DELAY * 1000));
  }
  const t = setTimeout(onDone, TOTAL_DURATION_MS);
  return () => {
    clearTimeout(t);
    whips.forEach((id) => clearTimeout(id));
  };
}, [onDone]);
```

- [ ] **Step 3: Wire thump into TrickPlayView**

In `src/components/views/TrickPlayView.tsx`, add the import:

```tsx
import { playSound } from '@/client/sounds';
```

We want thump to fire every time `currentTrick.plays.length` increments. Add a useEffect that watches that length and a ref that holds the last seen length:

```tsx
const lastPlaysCount = useRef(0);
useEffect(() => {
  const cur = trick?.plays.length ?? 0;
  if (cur > lastPlaysCount.current) {
    playSound('thump');
  }
  lastPlaysCount.current = cur;
}, [trick?.plays.length]);
```

- [ ] **Step 4: Wire sweep into the collect transition**

Still in `TrickPlayView.tsx`, modify the trick state-machine effect to fire sweep when transitioning into the collect phase:

```tsx
useEffect(() => {
  if (!trick || trick.plays.length < 4 || trick.winnerSeat === undefined || trick.winnerSeat === null) {
    if (collectPhase !== 'idle') setCollectPhase('idle');
    return;
  }
  if (completedAt.current === trickKey) return;
  completedAt.current = trickKey;
  setCollectPhase('pause');
  const t1 = setTimeout(() => setCollectPhase('pulse'), 700);
  const t2 = setTimeout(() => {
    setCollectPhase('collect');
    playSound('sweep');
  }, 700 + 400);
  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
}, [trick, trickKey, collectPhase]);
```

- [ ] **Step 5: Verify typecheck, lint, unit tests, full E2E**

```bash
npm run lint && npm run typecheck && npm test -- --run && npm run test:e2e
```
Expected: lint clean, typecheck clean, 109 unit tests pass, 10 E2E tests pass.

- [ ] **Step 6: Commit**

Draft commit message:
```
Wire sounds: shuffle/whip on deal, thump on play, sweep on collect

DealAnimation plays a shuffle once and one whip per card during the
deal cadence. TrickPlayView plays a thump every time the current
trick gains a play (any seat), and a sweep when the collect phase
begins. Sounds are preloaded once on app mount via SoundsPreloader.
With placeholder MP3s the system is silent; replacing files in
public/sounds/ enables real audio.
```

```bash
git add src/components/SoundsPreloader.tsx src/app/layout.tsx src/components/play/DealAnimation.tsx src/components/views/TrickPlayView.tsx
git commit -m "Wire sounds: shuffle/whip on deal, thump on play, sweep on collect"
```

---

## Task 18: Gate motion + sound behind `prefers-reduced-motion`

**Files:**
- Create: `src/client/useReducedMotion.ts`
- Modify: `src/components/play/DealAnimation.tsx`
- Modify: `src/components/views/TrickPlayView.tsx`

Users with `prefers-reduced-motion: reduce` should get no deal animation, no card-fly arc, no trick collection sweep — cards just appear and disappear. Hover lift stays (it's functional feedback, not gratuitous motion). Sound also disables.

- [ ] **Step 1: Create the hook**

```tsx
// src/client/useReducedMotion.ts
'use client';
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}
```

- [ ] **Step 2: Apply in DealAnimation**

In `src/components/play/DealAnimation.tsx`:

```tsx
import { useReducedMotion } from '@/client/useReducedMotion';
```

At the top of the component body:

```tsx
const reduced = useReducedMotion();

useEffect(() => {
  if (reduced) {
    onDone();
    return;
  }
  // (existing shuffle + whips + total-duration timer here)
}, [onDone, reduced]);
```

When `reduced` is true, the overlay still renders but `onDone()` fires immediately on the next tick. The 52 motion.divs technically still render but their `transition.duration` should be 0:

```tsx
transition={{
  delay: reduced ? 0 : i * PER_CARD_DELAY,
  duration: reduced ? 0 : FLIGHT_DURATION,
  ease: [0.2, 0.7, 0.2, 1],
  times: [0, 0.15, 0.85, 1],
}}
```

- [ ] **Step 3: Apply in TrickPlayView**

In `src/components/views/TrickPlayView.tsx`:

```tsx
import { useReducedMotion } from '@/client/useReducedMotion';
```

At the top of the body:

```tsx
const reduced = useReducedMotion();
```

In the trick state-machine effect, when `reduced` is true skip the pause/pulse and jump straight to collect (or even skip collect entirely — server will advance state regardless):

```tsx
useEffect(() => {
  if (!trick || trick.plays.length < 4 || trick.winnerSeat === undefined || trick.winnerSeat === null) {
    if (collectPhase !== 'idle') setCollectPhase('idle');
    return;
  }
  if (completedAt.current === trickKey) return;
  completedAt.current = trickKey;
  if (reduced) {
    setCollectPhase('collect');
    return;
  }
  setCollectPhase('pause');
  const t1 = setTimeout(() => setCollectPhase('pulse'), 700);
  const t2 = setTimeout(() => {
    setCollectPhase('collect');
    playSound('sweep');
  }, 700 + 400);
  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
  };
}, [trick, trickKey, collectPhase, reduced]);
```

The CollectingPile's framer-motion transition should also pick up reduced motion via the prop. Update its `transition` to:

```tsx
transition={{ duration: reduced ? 0 : 0.5, ease: [0.2, 0.7, 0.2, 1], delay: reduced ? 0 : i * 0.02 }}
```

Pass `reduced` as a prop into `CollectingPile`.

- [ ] **Step 4: Verify**

```bash
npm run lint && npm run typecheck && npm test -- --run
```
Expected: clean.

- [ ] **Step 5: Commit**

Draft commit message:
```
Gate motion behind prefers-reduced-motion

Adds useReducedMotion hook. DealAnimation calls onDone immediately
and zeroes per-card transitions when the user prefers reduced motion.
TrickPlayView skips the pause/pulse beats and shortens the collect
transition to 0. Hover lift remains (functional feedback).
```

```bash
git add src/client/useReducedMotion.ts src/components/play/DealAnimation.tsx src/components/views/TrickPlayView.tsx
git commit -m "Gate motion behind prefers-reduced-motion"
```

---

## Task 19: E2E — bid-panel viewport bounds and deal-animation completion

**Files:**
- Create: `tests/e2e/polish.spec.ts`

- [ ] **Step 1: Write the new spec**

```typescript
// tests/e2e/polish.spec.ts
import { test, expect, type Browser, type Page, type BrowserContext } from '@playwright/test';

async function fourPlayerRoomReady(browser: Browser) {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((c: BrowserContext) => c.newPage()));
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
  return { contexts, pages, host };
}

test('deal animation overlay appears then disappears', async ({ browser }) => {
  const { contexts, host } = await fourPlayerRoomReady(browser);

  // Overlay is visible at first.
  await expect(host.getByTestId('deal-animation')).toBeVisible({ timeout: 1000 });
  // Overlay disappears within ~3.5 s of phase change.
  await expect(host.getByTestId('deal-animation')).toHaveCount(0, { timeout: 5000 });

  await Promise.all(contexts.map((c: BrowserContext) => c.close()));
});

test('bid panel does not overflow viewport top after a bid is placed', async ({ browser }) => {
  const { contexts, host, pages } = await fourPlayerRoomReady(browser);

  // Wait for the deal overlay to clear so the bid panel is interactable.
  await expect(host.getByTestId('deal-animation')).toHaveCount(0, { timeout: 5000 });

  // Host places a bid of 75.
  await host.getByRole('button', { name: '75', exact: true }).first().click();

  // Verify the panel's bounding box top is >= 0 across all clients (no overflow).
  for (const page of pages) {
    const panel = page.getByTestId('bid-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
  }

  await Promise.all(contexts.map((c: BrowserContext) => c.close()));
});

test('mute toggle is reachable and persists', async ({ browser }) => {
  const { contexts, host } = await fourPlayerRoomReady(browser);

  await expect(host.getByTestId('deal-animation')).toHaveCount(0, { timeout: 5000 });

  const toggle = host.getByTestId('mute-toggle');
  await expect(toggle).toBeVisible();
  // Default is unmuted.
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  // Reload and confirm persistence.
  await host.reload();
  const toggle2 = host.getByTestId('mute-toggle');
  await expect(toggle2).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

  await Promise.all(contexts.map((c: BrowserContext) => c.close()));
});
```

- [ ] **Step 2: Run only the new spec**

```bash
npm run test:e2e -- polish.spec.ts
```
Expected: 3 tests pass.

If the bid-panel overflow test fails — verify by running it with `--headed` and observing where the panel sits relative to viewport top. The fix is to adjust `BiddingView.tsx`'s wrapping container — the panel should be inside a container with `pt-8` or similar to give it safe top padding. The original Task 10 keeps the panel at a fixed height; this test verifies the integration.

- [ ] **Step 3: Run the full E2E suite to confirm nothing regressed**

```bash
npm run test:e2e
```
Expected: all tests pass (10 prior + 3 new = 13).

- [ ] **Step 4: Commit**

Draft commit message:
```
E2E: deal animation, bid-panel bounds, mute toggle persistence

Three new Playwright tests verify the polish:
1. The deal-animation overlay appears on start and clears within 5 s.
2. The bid panel's bounding-box top remains >= 0 after a bid is
   placed (overflow regression guard).
3. Mute toggle aria-pressed reflects state and persists across
   page reload.
```

```bash
git add tests/e2e/polish.spec.ts
git commit -m "E2E: deal animation, bid-panel bounds, mute toggle persistence"
```

---

## Task 20: Manual smoke test + merge to main

This task captures the final hands-on verification before merging. Subagent doing this task should execute the checklist and report any deviations.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Run through the smoke checklist (open 4 browsers)**

Open four browser windows side-by-side at `http://localhost:3000`. Create a room in window 1, join from the other three.

For each item below, verify the behavior. If anything is broken, file a `// TODO(polish):` comment in the relevant file and continue — fix at end.

- [ ] Lobby renders correctly (unchanged from before).
- [ ] On Start Game: deck appears at center, 52 cards fly out to all 4 seats clockwise over ~2 s. No audible errors. No console errors.
- [ ] After deal: your-hand 13 cards visible, comfortable size (~88 × 124). Opponent fans on left/right are *vertical* fans (cards rotated 90°, bowed outward). Top opponent is a horizontal fan.
- [ ] Bid panel sits below the top of viewport, doesn't overflow when a bid is placed. The 8 quick-bid buttons remain in a 2×4 grid.
- [ ] Hover over your-hand card: card lifts ~12 px, shadow grows. Other cards don't move.
- [ ] On your turn after the bidder's turn: illegal-suit cards are dimmed to 50% opacity, can't be clicked.
- [ ] Click a card: lifts 60 px, second click commits, card arcs to center slot (or appears at slot if reduced motion).
- [ ] Each card play emits a thump sound (silent if placeholder MP3s; check console for no errors).
- [ ] After 4th card: ~700 ms pause, winning card pulses gold, all 4 cards sweep toward winner over ~500 ms with fade-out, sweep sound fires.
- [ ] Mute toggle in top-right: click to mute (icon changes to 🔇). Click again to unmute. Refresh: state persists.
- [ ] Full game end → EndView still renders correctly with mute toggle present.
- [ ] Toggle macOS "Reduce Motion" in System Settings → Accessibility → Display. Start a new game: deal animation should be near-instant. Trick collection should also be near-instant.

- [ ] **Step 3: If any TODO(polish) markers were added, address them in additional commits**

Run lint and tests again:

```bash
npm run lint && npm run typecheck && npm test -- --run && npm run test:e2e
```

- [ ] **Step 4: Merge the feature branch to main**

Draft commit message for the merge:
```
Merge feat/ui-polish: cozy card room polish pass

- Comfortable card sizing (88×124 player, 44×62 opponent vertical fans)
- Clockwise deal-out animation at game start
- Group-pile trick collection with gold winning-card pulse
- Subtle hover lift + dim-illegal-cards affordance
- Fixed-height bid panel (overflow fix)
- Minimal foley via Howler.js with master mute toggle
- framer-motion for all layout transitions
- prefers-reduced-motion gating throughout
```

```bash
git checkout main
git merge --no-ff feat/ui-polish -m "Merge feat/ui-polish: cozy card room polish pass"
git branch -d feat/ui-polish
```

- [ ] **Step 5: Verify final state**

```bash
git log --oneline -5
npm run lint && npm run typecheck && npm test -- --run && npm run test:e2e
```
Expected: feature branch commits visible on main; all checks clean.

---

## Spec coverage check

| Spec section                                    | Tasks         |
| ----------------------------------------------- | ------------- |
| Visual direction (cozy)                         | 2, 3, 4       |
| Card sizing & table layout                      | 3, 4, 11, 12, 13 |
| Deal-out animation                              | 15, 16, 17    |
| Trick play: card-play arc                       | 12, 13        |
| Trick play: trick collection (pulse + pile)     | 14, 17        |
| Card hover & legal-move affordance              | 3, 12         |
| Bidding panel (overflow fix)                    | 10            |
| Sound palette (minimal foley)                   | 6, 7, 8, 9, 17 |
| Tech: framer-motion + howler                    | 1             |
| Reduced-motion handling                         | 18            |
| Verification: smoke, E2E, unit                  | 19, 20        |

All sections covered.

## Notes for the executing engineer

- **Commit message rule:** the user requires that every commit message draft be shown and approved before the `git commit` runs. Each task above includes a "Draft commit message" block — display it to the user verbatim and wait for approval before running the commit.
- **No `Co-Authored-By` trailer** in any commit message (user preference).
- **Audio files are zero-byte placeholders** — Howler logs a warning on missing audio but does not crash. The audio pipeline is wired and ready; replacing the four files with real CC0 clips later enables sound without code changes.
- If you hit a Playwright timing flake from animations: prefer adding `data-testid` markers and waiting on them, not adding `waitForTimeout` calls.
- The plan executor running each task as a fresh subagent should read `docs/superpowers/specs/2026-05-13-ui-ux-polish-design.md` for full context when in doubt.
