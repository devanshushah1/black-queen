# UI/UX Polish — Design Spec

**Date:** 2026-05-13
**Status:** Approved
**Predecessors:** [2026-05-12 Black Queen Game Design](2026-05-12-black-queen-game-design.md)

## Context

The game is feature-complete end-to-end (lobby → bidding → trump/partner → trick play → end → reconnect), but the UI doesn't yet feel up to par. Specifically:

1. Cards are too small to read comfortably.
2. Left/right opponents render as a vertical column of horizontal rectangles instead of vertical fans.
3. The bidding panel grows tall and clips above the viewport once a bid is placed.
4. Hover on hand cards doesn't lift — they feel inert.
5. No visual feedback for who won a trick — cards just disappear.
6. No animations: cards pop into existence at game start, then between hand and center.
7. No sound.

This spec defines a focused polish pass that addresses each issue, anchored to a single overall direction so the moving pieces compose into something coherent rather than feeling like a bag of features.

## Visual direction — "Cozy Card Room"

Warm, tactile, unhurried. The intent is "playing with friends in someone's library" rather than "tournament client" or "mobile arcade."

- **Palette:** existing felt-900/800/700 greens + gold-400/500/600 accents (no change). Card face ivory `#fafaf5` (not pure white) for warmth.
- **Easings:** `cubic-bezier(.2,.7,.2,1)` for most motion; durations 280–450ms (slow enough to read, fast enough to keep momentum).
- **Shadows:** deeper, more diffuse than the current flat shadows — feels like real cards on felt.
- **No celebratory flourishes** (no confetti, no burst). Trick wins are indicated with a gold pulse + smooth collection motion.

## Card sizing & table layout

| Position           | Card size            | Layout                                                                              |
| ------------------ | -------------------- | ----------------------------------------------------------------------------------- |
| You (bottom)       | **88 × 124**         | Horizontal fan, ~36° arc, ~140px radius. Cards overlap ~38px.                       |
| Top opponent       | **44 × 62** (back)   | Horizontal fan, ~22° arc, narrower radius.                                          |
| Left opponent      | **44 × 62**, rot 90° | **Vertical fan**, cards bowed outward (rotation runs `-90° ± 11°` across the fan).  |
| Right opponent     | **44 × 62**, rot 90° | **Vertical fan**, mirrored (rotation runs `+90° ± 11°`).                            |
| Played-cards (center) | **80 × 112**       | Four fixed slots anchored to N/E/S/W relative to viewer.                            |

Card sizes are defined as semantic tokens in the `Card.tsx` `SIZE_CLASSES` map. The "comfortable" scale above replaces the current "md" (56×80) for player hand and adds a new dedicated size for the center-played slot.

### Why vertical fans for left/right

The current implementation stacks left/right opponent cards as a vertical column of horizontal rectangles. The correct convention — and what every card game expects — is to rotate each card 90° so its long edge runs vertical, then fan them along the side with a slight outward bow.

## Deal-out animation (game start)

When the host clicks **Start Game** and the phase transitions to `bidding`, before the bidding panel appears:

1. A deck stack renders at the center of the table — three back-card sprites with stacked drop-shadows for the "thick deck" look. Hold for ~200ms.
2. **Clockwise dealer:** 52 cards leave the deck one at a time, ~40ms apart, in seat order N → E → S → W → N…, for ~2.1s total.
   - Each card flies on a slight curve from the deck center to its destination fan slot at the recipient seat.
   - During flight, each card rotates 5–10° to feel "tossed" rather than slid.
   - Lands face-down. The recipient's fan-position math is the same as the final hand layout — the card simply lands where it will live.
3. **Your-hand flip-ripple:** after the 52nd card lands, your 13 cards flip face-up in sequence left → right, ~30ms per card, ~400ms total.
4. The bidding panel fades in (200ms) after the flip ripple completes.

**Sounds:**
- Deep "shuffle" once before the first card.
- Soft "whip" per card during the deal (~52 plays).

## Trick play polish

### Card-play arc (your turn)

When you click a legal card in your hand:

1. The card lifts ~30px in place over ~80ms (acknowledgment).
2. The card arcs to its center slot — a curved path (Bezier-driven via `framer-motion`) over 300–350ms `ease-out`, with a slight `rotate` toward the destination orientation.
3. On landing, a gentle "thump" sound fires.

When an opponent plays a card (received via socket update):

1. A face-down card flies from their seat's fan area to the appropriate center slot.
2. At the apex of the arc, it flips face-up so it lands showing its rank/suit.
3. Same "thump" sound.

### Trick collection (after the 4th card lands)

1. **~700ms pause** so everyone can read the trick.
2. **Winning card pulses gold:** scale 1.0 → 1.18 → 1.05 over ~400ms, with a `0 0 18px 4px #d4a437` glow that fades to 0. Concurrent: the winning seat's player-label gets a brief gold underline.
3. **Group pile collection:** all 4 cards travel together as a pile toward the winning seat (~500ms `ease-out`), converging on a single point near the seat label. Cards fade to opacity 0 at the end of the journey.
4. The winning seat's trick-count badge ticks up with a tiny scale-up bump (`scale(1.0) → 1.2 → 1.0` over 200ms).
5. "Sweep" sound fires once at the start of the collection motion.

Total trick-finish cycle: ~1.6s from 4th-card-land to trick-count-bump.

## Card hover & legal-move affordance

- **Hover (your-hand cards only):** `translateY(-12px)` + shadow grows, 120ms ease-out. The card **keeps its fan rotation** (no straightening) per prior feedback that straightening looked jumpy.
- **Click feedback:** in addition to the lift-then-arc described above, the cursor changes to `pointer` for legal cards.
- **Legal-move affordance:** on your turn when a suit has been led and you have cards of that suit:
  - Illegal cards → 50% opacity, no hover lift, `cursor: not-allowed`.
  - Legal cards → full opacity, hover lift, `cursor: pointer`.
- When it's not your turn, all cards are full-opacity but inert (no hover lift, no click).

## Bidding panel (overflow fix)

The current `BidPanel` grows tall when a bid is placed (adds the "Pass at N" button and shifts buttons by `+5/+10/...` increments), pushing the panel above the viewport.

Restructured layout:

- **Fixed total height** regardless of state. The container is `min-h-[280px] max-h-[280px]` (or similar token).
- **Header row:** current bid + holder, OR "no bid yet · floor 75". Fixed height.
- **Quick-bid grid:** stable **2 × 4** (8 buttons), always rendered. Button labels update as the floor shifts.
- **Pass row:** always reserved height, but the pass button only renders when a current bid exists. (Empty space when no bid — keeps total height stable.)
- Panel sits **top-anchored** in the play area with safe padding above. Bottom edge sits well above the player's hand.

## Sound palette (minimal foley)

| Trigger              | Sound         | Notes                                      |
| -------------------- | ------------- | ------------------------------------------ |
| Pre-deal             | Deep shuffle  | ~600ms, fires once before deal             |
| Each dealt card      | Soft whip     | Very low volume, plays 52× during deal     |
| Card play (any seat) | Card thump    | Soft, ~80ms                                |
| Trick collection     | Sweep / swoosh| Once per trick, fires at start of motion   |

- **Master mute toggle** in the top-right corner of all in-room views. State persisted in `localStorage` under `bq:muted`.
- Default: **unmuted**. Loudest sound (shuffle) capped at ~50% of max linear volume to avoid surprises.
- **Source:** 4 curated freesound.org clips (prefer CC0; fall back to CC-BY with an attribution file in `public/sounds/ATTRIBUTION.md`). Files shipped as `.mp3` in `/public/sounds/`.
- Total payload target: under 150 KB combined.

## Technical approach

### New dependencies

- **`framer-motion`** (~25 KB gzipped) — for all layout/motion animations. Cards become `<motion.div layoutId={card.id}>` so moves between hand-slot → center-slot → winner-seat are automatic FLIP animations. Use `AnimatePresence` for entry/exit (deal, trick-clear).
- **`howler`** (~8 KB gzipped) — for sound playback with master-mute API and pooled simultaneous playback (needed for the rapid-fire whip during dealing).

No state-management changes. Animations are driven entirely off the existing `room` and `yourHand` state (plus a small new `useSettings` slice for `muted` flag).

### Layered structure

```
src/client/sounds.ts                  (new) — Howler singleton + preload + play(name)
src/client/store.ts                   (modify) — add `muted: boolean` + `setMuted`
src/components/MuteToggle.tsx         (new) — top-right corner toggle, persists to localStorage
src/components/Card.tsx               (modify) — bigger sizes, hover lift, illegal-dim prop
src/components/play/CardBack.tsx      (modify) — bigger sizes to match
src/components/play/PlayerHand.tsx    (modify) — new fan geometry, click-to-play arc via framer-motion
src/components/play/OpponentFan.tsx   (split) — extract OpponentFanHorizontal + OpponentFanVertical
src/components/play/PlayedCardsCenter.tsx (modify) — fixed seat slots, winning-card pulse,
                                                    trick-collect motion, framer-motion layoutId
src/components/play/DealAnimation.tsx (new) — runs once at bidding-phase entry, drives the deal
src/components/bidding/BidPanel.tsx   (modify) — fixed-height layout
src/components/views/TrickPlayView.tsx (modify) — wrap in <LayoutGroup>, mount DealAnimation
src/components/views/BiddingView.tsx  (modify) — host the DealAnimation overlay
public/sounds/shuffle.mp3             (new asset)
public/sounds/whip.mp3                (new asset)
public/sounds/thump.mp3               (new asset)
public/sounds/sweep.mp3               (new asset)
public/sounds/ATTRIBUTION.md          (new, if any CC-BY files used)
tailwind.config.ts                    (modify) — add cozy shadow tokens + ease curves
```

### Seat-to-screen mapping

Re-use the existing `positionFor()` helper in `PlayedCardsCenter.tsx` and the `rotate()` helper in `TrickPlayView.tsx`. The viewer-relative seat ordering is `(seat - viewerSeat + 4) % 4 → {0: bottom, 1: left, 2: top, 3: right}`.

Both new dealer-origin and trick-collection-destination calculations should derive seat-relative coordinates from this mapping rather than re-doing the math.

## Out of scope (deferred)

- Trick history viewer (see one previous trick)
- Card-back customization
- Background music
- End-of-game confetti or celebration sting (cozy direction rejects this)
- Player avatars beyond existing initial circles
- Internationalization
- Accessibility audit beyond `prefers-reduced-motion` gating (see below)

## Reduced-motion handling

When `prefers-reduced-motion: reduce` is set:

- Deal-out animation skipped — cards appear in their final positions.
- Card-play arc replaced by 100ms fade-in at the destination.
- Trick collection: cards disappear after the 700ms read-pause, no motion.
- Hover lift kept (it's still functional UI feedback, not gratuitous motion).

Test by running with macOS "Reduce Motion" enabled in System Settings → Accessibility.

## Verification plan

1. **Visual regression:** smoke each phase manually — lobby (no change), deal-out (new animation), bidding (fixed-height panel), trump/partner (no change), play (new card sizes + opponent vertical fans + animations + trick collection), end (no change).
2. **Multi-browser:** 4-window manual test in Chromium-based browser to verify view-rotation is correct for each seat (left/right vertical fans must match the seat-relative position from the viewer's POV).
3. **Sound:** verify mute toggle persists across reload; verify no sound plays when muted; verify no audio errors in console.
4. **Reduced motion:** toggle macOS Reduce Motion mid-game; verify subsequent animations skip cleanly.
5. **Unit tests:** existing 103 unit tests should still pass (animations are presentational; no logic change).
6. **E2E tests:** existing 10 Playwright tests should still pass. Some `getByText` / `getByRole` selectors may need timing adjustments to wait for animations.

## Risks & mitigations

- **Animation jank on low-end machines:** framer-motion is GPU-accelerated for transforms; keep card animations to `transform` + `opacity` (no layout properties).
- **Audio autoplay policies:** modern browsers block audio before a user gesture. The first sound trigger is host-clicking "Start Game" — that's a gesture, so we're fine. If we ever auto-play sound before any gesture, gate behind a "click to enable sound" prompt.
- **localStorage collision:** prefix all keys with `bq:` (already done for `bq:session`). Add `bq:muted`.
- **E2E flakes from animation timing:** add `data-testid` attributes to key landing states so Playwright can wait on "card-played" / "trick-cleared" markers rather than visual conditions.
