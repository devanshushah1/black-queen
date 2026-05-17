# UI/UX Polish Follow-Up — Design Spec

**Date:** 2026-05-16
**Status:** Approved
**Predecessors:** [2026-05-13 UI/UX Polish Design](2026-05-13-ui-ux-polish-design.md)

## Context

After shipping Plan 6 we ran a manual smoke test in four side-by-side browser windows. Four concrete regressions / shortcomings surfaced:

1. **Deal animation cards visibly overlap the bidding panel.** `DealAnimation` is an overlay (correct) but `BiddingView` renders the `BidPanel` and player hand stub *underneath* the overlay. The result is animated card backs flying *across the panel face*, which reads as broken.
2. **Bidding view cramped and visually inconsistent with the play view.** The bidding screen uses a separate small layout: opponent cards stack as tiny stubs at the top, the player's hand is a compact preview. Once trick play starts the layout suddenly explodes into the full table. The transition is jarring and the bidding screen feels underdesigned.
3. **Trick-play center looks messy when fewer than 4 cards are down.** The four `N/E/S/W` slots in the 240 × 240 container spread the played cards far apart — the top card reaches near the top opponent's fan and obscures its seat label, and a 3-card trick leaves an obvious empty quadrant.
4. **No audible audio.** The four `public/sounds/*.mp3` files are zero-byte placeholders. Howler decodes them as empty, so every `playSound()` call is silent. The pipeline works but the user experience is silence.

This spec captures the unified fix for all four, anchored to the same cozy direction as Plan 6.

## 1. Deal-animation gating

The deal animation owns the screen until it completes (~2.7 s). Nothing else in the bidding view renders during that window.

- `BiddingView` gates the **entire table body (info badges, opponent fans, player hand, bid panel)** behind `!dealing`.
- While `dealing === true`, the only rendered descendants of `<main>` are: `MuteToggle` (top-right) and `DealAnimation` (full-screen overlay).
- Once `DealAnimation.onDone` fires, `dealing` flips to `false` and the table body fades in over 200 ms (`opacity 0 → 1`, no slide).
- The chat panel in the bottom-right of the page remains visible throughout (it's outside the table body).

Reconnect behavior unchanged: `dealing` only initializes to `true` when the player enters a fresh-deal bidding state (`currentBid === null && passedSeats.length === 0`). Mid-bid reconnects skip the animation and render the table immediately.

## 2. Bidding view layout overhaul

The bidding view adopts the same table layout as `TrickPlayView`, with the `BidPanel` positioned as a centered overlay above the (empty) played-cards area.

### Structure (top to bottom, left to right)

- `<main>` (the felt background)
  - `MuteToggle` (fixed top-right, unchanged)
  - **Phase badge** (small, top-left): "BIDDING PHASE · Min 75 · Max 150 · Increments of 5". One short pill. Replaces the dominant header that currently centers above the panel.
  - **Table area** (`max-w-4xl mx-auto h-[420px]` — slightly taller than the play view to give vertical room for status pills)
    - **Top opponent**: horizontal back fan (13 cards, `OpponentFanHorizontal`) + name label + decision pill (`deciding…` | `Passed` | `bid 85`)
    - **Left opponent**: vertical back fan + name (rotated -90°, sitting outside the fan) + decision pill
    - **Right opponent**: vertical back fan + name (rotated +90°) + decision pill
    - **Center**: `BidPanel` floating, absolutely centered (`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`)
  - **Player hand row** (below table area)
    - Centered xl-size horizontal fan of the player's 13 sorted cards (`<PlayerHand>` with `active={false}` — no click-to-stage during bidding)
    - Player name + decision pill underneath
  - `ChatPanel` (bottom-right fixed, unchanged)

`HandPreview` is removed (no other consumers).

### Decision pills

Re-use the existing `StatusPill` component. Three states per player:
- `deciding…` (neutral chip) — default until they act
- `Passed` (red-ish chip) — when their seat is in `bid.passedSeats`
- `bid 85` (gold chip) — when `bid.currentBidderSeat === seat`

### View-only player hand during bidding

`PlayerHand` already accepts `active: boolean`. Calling with `active={false}` disables click handlers but keeps the hover lift off (hover lift is gated on `active && isLegal`). Cards still display at full xl size. `legalKeys` is irrelevant (passed as `null`).

The dim-illegal styling is also gated on `active`, so all 13 cards display at full opacity.

### Visual quality

The bidding screen now visually matches the play screen one-to-one — same table dimensions, same opponent fan sizes, same player hand size. The only difference is the center occupant (BidPanel vs PlayedCardsCenter) and the absence of trump/bid/partner info badges.

This eliminates the jarring transition into play and gives the bidding moment more visual presence.

## 3. Trick-play center — "tossed pile"

Replace the four N/E/S/W slot positions in `PlayedCardsCenter` with center-converging positions, each card rotated to reflect the direction it came from.

### Geometry

- Container: `160 × 160` (was 240 × 240).
- Card size: **`md` (56 × 80)** instead of `lg` (80 × 112).
- Each played card is absolutely positioned at the container's center, then translated and rotated:

| Viewer-relative seat | Translate         | Rotate   |
| -------------------- | ----------------- | -------- |
| Top (north)          | `(0, -22 px)`     | `-2°`    |
| Right (east)         | `(22 px, 0)`      | `+10°`   |
| Bottom (south / you) | `(0, +22 px)`     | `+2°`    |
| Left (west)          | `(-22 px, 0)`     | `-12°`   |

- Z-index: in play order (later plays on top). The `currentTrick.plays` array is already ordered; map `i → zIndex = 10 + i`.
- Per-card subtle drop shadow (`shadow-card-rest`) so overlap reads as physical stacking.

### Why these numbers

- 22 px from center keeps every card overlapping the center — the visual "puddle" stays compact.
- The east/west rotations are larger (±10/12°) than north/south (±2°) because horizontal cards have more visual room to tilt without crossing into other cards. North/south stay near vertical for legibility.
- The container shrinks to 160 × 160 so it never reaches into the opponent fan zones.

### Animations unchanged

Winning-card gold pulse and group-pile sweep animations from Plan 6 remain unchanged in *concept*; the new positions become the start-frame for the sweep. The pulse animation now scales 1.0 → 1.18 → 1.05 *from* the tilted resting position (framer-motion handles this via `animate`).

## 4. Web Audio sound synth

Replace the file-based Howler implementation with a Web Audio API synth. Same public API (`preloadSounds()`, `playSound(name)`), same `muted` gate.

### Rationale

- Placeholder MP3s require manual curation we can't automate. Howler with empty files yields silence.
- A small in-browser synth produces all four sounds in <100 lines of code, zero asset payload, and works immediately.
- Sound quality is acceptable for a cozy card game: the synthesized "thump", "whip", "shuffle", and "sweep" are recognisable card-table foley, not video-game beeps.

### Sounds

| Name      | Synthesis                                                                                                       | Duration |
| --------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| `shuffle` | White noise → bandpass filter sweeping 2500 → 700 Hz, Q ≈ 1.2, attack 40 ms, exp decay                          | 600 ms   |
| `whip`    | White noise → highpass filter sweeping 2000 → 500 Hz, short attack 15 ms, exp decay                             | 120 ms   |
| `thump`   | Sine oscillator 110 → 55 Hz (pitch drop), plus a lowpass-filtered noise click at attack for the felt-tap layer  | 150 ms   |
| `sweep`   | White noise → bandpass filter sweeping 800 → 3000 Hz, gain envelope (fade-in 60 ms, sustain 0.06, decay)        | 450 ms   |

All sounds peak at ≤ 0.22 linear gain to keep the mix gentle.

### AudioContext lifecycle

- Single shared `AudioContext` instance created lazily on first `preloadSounds()` or `playSound()` call.
- Browsers may start the context in `suspended` state if no user gesture has happened yet. `playSound()` calls `.resume()` defensively before scheduling. The first sound (`shuffle`) fires from `DealAnimation` which is mounted only after the host clicked **Start Game** — that's a user gesture, so resume always succeeds.
- Mute gate: `playSound()` early-returns when `useGameStore.getState().muted === true`. No nodes are created.

### Dependency cleanup

- Remove `howler` from `package.json` dependencies.
- Remove `@types/howler` from dev dependencies.
- Delete `public/sounds/*.mp3` and `public/sounds/ATTRIBUTION.md` (no longer needed). Keep the directory removal out of git history with a single delete commit.
- Rewrite `tests/unit/sounds.test.ts` to mock `AudioContext` and verify:
  - `playSound('thump')` constructs and starts nodes when unmuted
  - `playSound('thump')` is a no-op when `muted === true`
  - `playSound('nonsense' as never)` does not throw

## 5. Files affected

```
src/client/sounds.ts                     (rewrite — Web Audio synth)
tests/unit/sounds.test.ts                (rewrite — mock AudioContext, not howler)
src/components/views/BiddingView.tsx     (rewrite — mirror TrickPlayView layout, gate body on !dealing)
src/components/play/PlayedCardsCenter.tsx (modify — tossed-pile geometry, md cards, 160 px box)
src/components/bidding/HandPreview.tsx   (delete — no longer used)
src/components/bidding/BidPanel.tsx      (minor — confirm sizes still work as centered overlay)
public/sounds/shuffle.mp3                (delete)
public/sounds/whip.mp3                   (delete)
public/sounds/thump.mp3                  (delete)
public/sounds/sweep.mp3                  (delete)
public/sounds/ATTRIBUTION.md             (delete)
package.json                             (remove howler + @types/howler)
package-lock.json                        (auto-updated)
```

`TrickPlayView.tsx` does not change — only `PlayedCardsCenter` is updated and `TrickPlayView` consumes it.

## 6. Out of scope (deferred)

- Refactoring shared table layout into a `TableLayout` component used by both `BiddingView` and `TrickPlayView` (would be cleaner long-term, but is a bigger refactor than this fix needs).
- Trump/partner view layout polish (looks acceptable; not in the user's complaint).
- Per-trick history scrubber.
- Card-back customization.
- Per-trick sound variation.
- End-of-game music sting.

## 7. Verification plan

### Manual smoke (4 windows side-by-side)

1. **Deal gating:** Host clicks Start. Verify the bidding screen body is invisible until ~2.7 s after click; only the deck-and-flying-cards animation is visible. After completion the table + bid panel fade in cleanly.
2. **Bidding layout:** Verify left/right opponent fans are vertical, top opponent is horizontal, player hand is the same xl size as in trick-play. BidPanel sits in the center of the table area, not pushed to the top of the viewport.
3. **Decision pills:** Place a bid as host. Verify host's pill shows "bid 85" gold. Guest passes — verify "Passed" red.
4. **Bidding → play transition:** Lock in trump+partner. Verify the layout doesn't shift visually — opponent fans and player hand stay in the same spots, BidPanel is replaced by the played-cards center.
5. **Tossed pile:** Play three cards in a trick. Verify they cluster near center with tilt, none reach into opponent fans. Verify 4th card lands then the winning-card pulse + sweep play.
6. **Audio:** Unmute (default). Verify a soft shuffle plays when Start is clicked. Verify a quiet whip on each dealt card. Verify a thump on every card play. Verify a sweep when a trick collects. Mute via top-right toggle — verify silence. Refresh, verify mute persists.
7. **Reduced motion:** Toggle macOS Reduce Motion. Start a new game. Verify deal-out is near-instant; verify trick collection is near-instant; sounds still play (motion gating doesn't disable sound).

### Automated

- All Plan 6 E2E tests (13) continue to pass — they assert layout markers (testid="bid-panel", "deal-animation", "mute-toggle") that this spec preserves.
- `tests/unit/sounds.test.ts` rewritten — must continue to verify mute gate.
- Add one new E2E test: `bidding view: player hand renders 13 xl-size cards after deal completes`. Asserts the hand is the same xl rendering as in play, not the old HandPreview.

## 8. Risks & mitigations

- **AudioContext autoplay policy variance:** Safari is strict about resuming `AudioContext` only on direct user-gesture event handlers. The first sound fires from inside `DealAnimation`'s `useEffect` which runs after the gesture; this works in Chrome/Firefox but Safari may keep the context suspended. Mitigation: call `audioCtx.resume()` inside the `onClick` handler of "Start Game" (one extra line). Spec change: thread a "user gesture handler" through the Start button to call `preloadSounds()` synchronously in the click event, then schedule sounds normally.
- **BiddingView regressions:** The bidding flow has 3 E2E tests. Rewriting the view risks selector breakage. Mitigation: keep `getByText(/Bidding phase/i)` and the quick-bid button text intact. Add `data-testid="bid-panel"` is already in place from Plan 6.
- **Howler in lockfile:** Removing the dep also requires `npm install` to update the lockfile. Lockfile churn is normal.
- **CardBack `size="md"` reuse:** The vertical opponent fans use md backs. The deal animation uses md backs. PlayedCardsCenter does NOT use CardBack — it uses `Card` directly. So the new md-card size for the played pile is `Card size="md"`, unrelated to CardBack.

## 9. Reduced motion handling (carry-forward)

Existing `useReducedMotion` hook continues to gate deal-out and trick-collection animations to zero duration. The new tossed-pile resting positions are static (no motion in their resting state), so reduced motion has nothing new to disable — the same gating from Plan 6 applies.
