# Black Queen — Online Multiplayer Game · Design Spec

**Date:** 2026-05-12
**Status:** Draft — awaiting user review
**Mockup reference:** `.superpowers/brainstorm/99470-1778624676/content/` (visual brainstorm artifacts, gitignored)

---

## Overview

A browser-based, real-time, 4-player trick-taking card game inspired by the regional Indian "Black Queen" / "Hakam" tradition. Four friends each open a browser, one creates a room, the others join via a 4-letter invite link, and they play a single hand of 13 tricks. The bidder + secret partner attempt to capture enough points to make their bid. There is no cumulative scoring or persistent account system in v1 — each game is a one-off.

### Goals

- Friends can play together over the web in under a minute (create room → share link → start).
- The game enforces all rules and legal moves; players never have to police each other.
- The UI feels like a real card table — fanned hands, played cards in the centre, opponents around the table.
- Disconnects don't end the game.

### Non-goals (v1)

- Mobile support (laptop / PC only).
- User accounts, login, profiles, persistent stats.
- Cumulative scoring across multiple hands.
- AI / bot players to fill empty seats.
- Spectators.
- Voice / video chat.
- Public matchmaking or room directory.

---

## 1 · Game Rules

### 1.1 Players & seating

- Exactly 4 players are required to start. The game cannot start with fewer.
- Players are seated **in order of joining the room** (seat 1 = first joiner, seat 2 = second, etc.). This seat-to-name mapping is fixed for the duration of the room and survives "Play Again".
- Turn order is **clockwise around the seat order** (seat 1 → 2 → 3 → 4 → 1 …).
- **View rotation per viewer:** the UI rotates each player's perspective so the viewer always sees themselves at the **bottom** seat. The seat-order assignment is unchanged — only the visual mapping rotates. From any viewer's perspective, clockwise = bottom → left → top → right → bottom.
- No spectators in v1.

### 1.2 Cards & deck

- Standard 52-card deck (no jokers).
- Each player receives **13 cards**, dealt before bidding starts.
- All 13 cards are visible to a player throughout bidding (so they can plan their bid).
- Standard rank order, low to high: 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A. Ace is always highest within a suit (but a trump card of any rank can still beat a non-trump Ace).

### 1.3 Point cards & scoring

- **5s** — each worth 5 points (4 × 5 = 20 pts).
- **10s** — each worth 10 points (4 × 10 = 40 pts).
- **Aces** — each worth 15 points (4 × 15 = 60 pts).
- **Queen of Spades** — worth 30 points (the marquee card; gives the game its name).
- Total points in deck = 150.
- Other cards (2–9 except 5/10, plus J, K, and non-spade Qs) carry **0 points**.
- The Queen of Spades has **no special trick behavior** — it is just a normal Queen for the purpose of trick ranking. The 30-point value is the only thing special.
- There are **no penalty cards or special captures** — capturing the QoS is identical to capturing any other point card except for its higher value.

### 1.4 Game phases

A single game runs in the following sequence:

1. **Lobby** — players join the room.
2. **Bidding** — players bid for the right to set trump and call a partner.
3. **Trump & partner selection** — the highest bidder picks a trump suit and calls a partner card.
4. **Play** — 13 tricks are played.
5. **End-of-game** — scores totalled, teams revealed, outcome announced.

---

## 2 · Phase: Lobby & Room Setup

### 2.1 Landing page

- Single screen with the Black Queen logo (♛) and one card-style container.
- The container has:
  - A **display name** text input (1–20 chars).
  - A **Create new room** button (primary).
  - A divider, then a **room code** input (4 uppercase letter cells) and a **Join room** button (secondary).
- Clicking "Create a new room" generates a new 4-letter room code and drops the user into a waiting room as **host**.
- Clicking "Join room" validates the code and routes the user to the join flow.

### 2.2 Room code & invite link

- Room codes are **4 uppercase letters**, randomly generated, unique among currently-active rooms (e.g., `ABCD`).
- Invite link format: `<host>/room/<CODE>` (e.g., `blackqueen.app/room/ABCD`).
- Anyone with the link can join (no auth) until the room is full (4 players).
- The link is visible in the lobby with a one-click Copy button.

### 2.3 Joining via invite link

- Visiting `/room/<CODE>` shows the landing-style card with:
  - "You've been invited to room **ABCD**" header.
  - A list of players already in the room (e.g., `Dev (host), Sam, Riya`).
  - A display-name input.
  - A **Join room** button.
- Name must be **unique within the room** (case-insensitive). If a duplicate is entered, the user is shown an inline error and asked to pick another.
- Length 1–20 chars. No profanity filter for v1.
- Once the room is full (4 players), additional joiners see "Room is full" and cannot enter.

### 2.4 Waiting room

- Shows the diamond seating layout used in the actual game — top, left, right, bottom seats.
- Filled seats show the player's name + avatar (initial-on-color).
- Empty seats show a dashed border with "+" / "Waiting…" / "seat N".
- The viewer is always rendered in the **bottom seat** (see Section 1.1 on view rotation).
- A header strip at the top shows the room code (monospace gold) and player count (`2 / 4`).

### 2.5 Two bottom cards: invite + start

Below the seating, two equally-styled cards sit side by side:

- **Invite card (left)** — `Invite friends · room code`, big `ABCD` in monospace gold, full URL underneath, full-width "Copy invite link" button. Greys out when the room is full.
- **Start card (right)** — `Players ready`, `2/4` progress, a sub-line (`Need 2 more to start` or `Everyone seated · let's play`), and the Start button. Highlights gold when 4/4.

### 2.6 Host

- The room creator is the **host**, marked with a gold ★ on their seat tile in the lobby.
- Host powers: start the game, kick a player from the lobby, end the game/room.
- Only the host can press **Start Game** (available when 4 seats are filled).
- If the host leaves, the role transfers to the longest-connected remaining player.

### 2.7 Chat

- A chat panel is anchored to the bottom-right of the lobby screen.
- Messages from players appear with their name in gold.
- System events (`Sam joined`, `Dev created the room`) appear in italic grey.
- The chat persists into the game phase — same widget, same position.

---

## 3 · Phase: Bidding

### 3.1 Rules

- **Minimum opening bid:** 75.
- **Maximum bid:** 150.
- **Bid increment:** must be a multiple of 5, and strictly greater than the current high bid.
- Bidding is **not turn-based** — anyone can bid at any moment ("fastest-finger-first"). The first bid placed at any value sets the high bid.
- After any bid is placed, the other three players each have two actions: **bid higher** or **pass**.
- A pass is recorded **against the current high bid**. If anyone subsequently bids higher, all passes reset and the three non-bidders again get to choose (any may now bid again).
- The current high bidder may **raise their own bid** preemptively (e.g., they bid 90, no one has countered, they raise themselves to 95 to force the next minimum to 100).
- **Bidding ends** when the three non-bidders have all passed against the current high bid.
- No timer — the game waits for explicit pass clicks.
- **All four passing on the opening bid** is out of scope for v1 (someone will always bid; documented edge case for later).

### 3.2 UI

- **Centre panel** replaces what would normally be the played-cards area:
  - Phase label: "● Bidding".
  - Big current-bid display (e.g., `90`) in gold; "held by *Aman*" beneath.
  - A **quick-bid grid** (4×2) showing the next 8 valid bids with a `+5`, `+10`, … delta label per button (or seven actual amounts + a "More…" tile for higher values).
  - A full-width **Pass** button below the grid.
- **Per-seat status pills** (below each player's name tag):
  - `live` (pulsing blue) — hasn't acted at current high bid.
  - `bid X` (gold) — currently holds the high bid.
  - `passed` (grey, dashed) — passed at current high.
- **Hand visible at bottom** for planning, arced like in play but with a gentler ~8 px hover lift and no click action.
- One-click confirms: clicking `Bid 95` places the bid immediately (no second-click confirm). Speed > misclick safety.

### 3.3 States the panel handles

- **No bid yet** — the grid shows opening-bid values (75, 80, 85, 90, …) and there is no Pass button.
- **You're not the current bidder** — quick-bid grid + Pass button.
- **You've passed at the current bid** — the grid is greyed out (`pointer-events: none`) and a small `You passed. Waiting for others.` line appears. If anyone raises, the grid re-enables.
- **You're the current bidder** — Pass button disappears; the grid offers higher amounts so you can self-raise.

---

## 4 · Phase: Trump & Partner Selection

### 4.1 Rules

- The bidder picks a **trump suit (hakam)** — any of the four suits, chosen freely.
- The bidder also picks a **partner card** — any specific card they do not hold (any of the 52 minus their 13).
- The player who holds that card is the bidder's hidden partner.
- The partner card **may be a high-point card** (Ace, 10, etc.) — fully legal.
- Trump suit and partner card are picked **on the same screen** and confirmed together.

### 4.2 Information disclosure

- After the bidder confirms:
  - The **trump suit** is announced publicly to all four players.
  - The **partner card** is announced publicly to all four players.
  - The player who holds the called card **silently knows** they are the partner (since they see the card in their own hand).
  - The bidder does not know who the partner is until the called card is played in a trick.
  - The other two players do not know who the partner is either, although the bidder's body language / play style during the game often gives it away.
- No explicit "You are the partner" message is shown to the partner — they can infer it from holding the called card. (This was an intentional design choice.)

### 4.3 UI — bidder's view

- A centred modal (max 540 px wide) sits in the middle of the stage.
- **Modal header** shows `YOU WON THE BID` label, `Need to score 95 with your partner`, and a row of **suit-count chips** showing how many cards the bidder has of each suit (e.g., `♥3 ♦2 ♣3 ♠5`). The selected trump's chip is highlighted gold.
- **Step 1 — Trump suit (hakam):** a 4-button grid (`♥ Hearts`, `♦ Diamonds`, `♣ Clubs`, `♠ Spades`). Clicking selects. The selected button turns gold.
- **Step 2 — Partner card:** a 4×13 grid (rows are suits, columns are ranks A→2). Each cell is a mini card chip. Cards the bidder owns are **dimmed + dashed-bordered** (not clickable). Clicking an unowned cell selects it (cell turns gold).
- **Live trump preview in the hand:** when a trump suit is selected, every card in the bidder's hand of that suit gets the gold trump ring. Lets the bidder feel the choice before locking.
- **Hand stays visible at full size** (arced at the bottom). Bidder can hover any card to inspect while deciding.
- **Opponent fans are hidden during this phase** (just their name tags + "passed at X" status pills remain). Reduces noise during the decision.
- **Confirm bar** at the bottom of the modal: `Trump ♠ · Partner A♥` summary + `Lock it in` button (disabled until both selections are made).

### 4.4 UI — non-bidders' view

- A centred waiting card: `Aman is choosing` (gold), `Trump suit and partner card`, three pulsing gold dots.
- The non-bidder's hand is still visible at the bottom (smaller / static), so they can mentally prepare.

### 4.5 Post-confirmation reveal banner

- Once the bidder locks in, all four players see a brief banner / summary:
  - `Trump (hakam)`: large suit symbol + name.
  - `Called partner card`: the rank+suit in red/black.
  - `Bidder & target`: bidder's name and required score.
- Game then transitions to play, with the bidder leading the first trick.

---

## 5 · Phase: Play (13 Tricks)

### 5.1 Trick mechanics

- The **first trick** is led by the bidder.
- Subsequent tricks are led by **whoever won the previous trick**.
- Play proceeds **clockwise** within a trick.
- A trick consists of one card from each of the 4 players.

### 5.2 Legal card-play rules

- If you have any cards of the **led suit**, you must play one. You are not allowed to play a non-led-suit card while holding a card of the led suit (including being barred from playing trump).
- If you are **void in the led suit**, you may play **any card** — trump or another off-suit. No requirement to trump in.
- There is **no requirement to beat the current winning card**. Players may intentionally play low (including dumping a point card to a teammate, which is the heart of the game's intrigue).

### 5.3 Trick resolution

- If at least one trump card was played in the trick, the **highest trump** wins.
- If no trump was played, the **highest card of the led suit** wins. Off-suit cards from non-led, non-trump suits ("fuses") cannot win.
- The winning player **collects** the four cards (the trick is added to their captured pile for scoring purposes).

### 5.4 Captured-trick visibility

- The **current trick in progress** is shown in the centre of the table for all players.
- After a trick completes, it stays visible briefly (~2 seconds) so players can see the result, then clears.
- The **most recently completed trick** can be reviewed via a "previous trick" button (FAB top-right). Only the single most recent trick — no full history. Once the next trick begins, the prior one becomes the new "previous".

### 5.5 Point tracking

- Running point totals are **not displayed** during play. Players must track points mentally.
- This is intentional — adds a memory dimension to the game.
- Final point totals are revealed at the end of the game.

### 5.6 UI — table layout (in-game)

- Diamond seating: top seat opponent across, left seat opponent, right seat opponent, you at the bottom.
- **Centre area:** played cards from the current trick, positioned by who played them (top card from top opponent, left card from left opponent, etc.). Empty slots dashed when a player hasn't played yet.
- **Your hand:** arced fan at the bottom, 64×96 px cards.
- **Opponents' hands:** rendered as fanned face-down backs, oriented per seat (top: vertical-ish fan facing you; left/right: rotated 90° fanning inward). The number of visible backs matches the number of cards they still hold (shrinks as the game progresses). A small count pill (`9`) sits next to each opponent's name tag.

### 5.7 UI — card design

- **Faces:** white background, classic corner (rank + small suit) top-left and bottom-right (rotated 180°), large central suit symbol. Serif font (Georgia) for ranks. Red for ♥/♦, black for ♣/♠.
- **Point cards:** a small gold pip below the rank in the corner showing the point value (`5`, `10`, `15`, or `30`).
- **Queen of Spades:** warm-cream tinted background with a thin gold inset frame. Plain ♠ in the centre (no chess-piece glyph). Distinct without inventing a new symbol.
- **Trump cards** (cards of the current trump suit in your hand): subtle gold ring around the card.
- **Backs:** navy diagonal stripe pattern with a faint dashed inner border. Used everywhere opponent cards appear.

### 5.8 UI — hand interaction

- **Hover** a card in your hand: that card lifts ~14 px in screen Y while **keeping its arc rotation**. No straightening, no scaling. Smooth as the cursor slides across the fan.
- **Click 1 (stage):** the card lifts out of the hand into a **centred preview area** above the hand — straightened, scaled ~1.0 (larger card variant 92×130), gold ring + glow. Original slot in the hand fades to a ghost. A "Click to play" pill appears under the preview.
- **Click 2 (play):** clicking the staged card again (or the "Click to play" pill) plays the card. It animates to the player's slot in the centre.
- **Click outside / click another card:** swaps the staged card or cancels.
- **Illegal cards:** dimmed (~55% brightness), no click action, cursor `not-allowed`. Example: when ♥ is led and you hold hearts, all non-heart cards in your hand are dimmed.

### 5.9 UI — info badges & floating actions

- **Top-left badges:** Trump suit (`♠ Trump`), current bid + bidder (`Bid 95 · Aman`), called partner card (`Called A♥`).
- **Top-right floating buttons:** previous-trick review (`↩`), chat toggle (`💬`).
- **Active-player indicator:** the player whose turn it is has a **gold border + soft glow** around their name tag. Pulses gently.
- **Your-turn nudge:** when it's your turn, a gold pill above your hand: `Your turn — must follow ♥` (or similar). Tells you the led suit if applicable.

### 5.10 UI — chat during play

- Chat panel remains anchored bottom-right (collapsible into the 💬 floating button).
- Same panel as the lobby — no resetting of message history.

---

## 6 · Phase: End-of-Game

### 6.1 Scoring

- After the 13th trick, the captured cards of each player are tallied.
- The **bidder team** = bidder + revealed partner. Their captured points are summed.
- The **other team** = the remaining two players. Their captured points are summed.
- If the bidder team's total **≥ the bid**, the bidder team wins.
- If less, the bidder team loses, and the other team wins by default.
- v1 has no cumulative score, no points awarded for the win/loss — just the single-game verdict.

### 6.2 Results screen

- A full-screen results panel replaces the table:
  - **Personalised verdict** at the top: `YOU WON` (gold, glowing) or `YOU LOST` (grey) — based on which team the viewer was on.
  - **One-line summary:** `Bidder team needed 95 · captured 105 · bid made` (green "got" colour on win, red on loss).
  - **Reveal bar:** `Trump was ♠ · Bidder called A♥ · Partner revealed: Dev`.
  - **Two team cards** side by side:
    - **Bidder team card** — labelled `Bidder team · Won` or `… · Lost`. Total points top-right. Player tiles for bidder and revealed partner (with role pills "bidder · 95" gold, "partner · had A♥" pink). The viewer's own tile is highlighted gold.
    - **Other team card** — same structure for the remaining two players.
    - Winning team: gold border + soft glow, gold point total. Losing team: dimmed.
  - **Captured point chips:** small horizontal chips listing every point card each team captured, with point-value pip. Queen of Spades has the warm-cream chip treatment. Lets players see exactly where the 150 points went.

### 6.3 Actions

- **Host only — `Play again — same seats`** button (gold). Clicking restarts the game with the same 4 players in the same seats. Cards are reshuffled; bidding starts fresh.
- **Everyone — `Leave room`** button (ghost / outline). Clicking removes the player from the room and routes them to the landing page.
- **Non-hosts** see `Waiting for [host] to start the next hand…` in italic grey where the Play Again button would be.
- The host may also leave; doing so transfers host to the longest-connected remaining player. The new host can then decide to start a new game (with replacement player if needed) or end the room.

---

## 7 · Multiplayer & State

### 7.1 Real-time requirements

- Game state must be reflected in all 4 clients in near-real-time (sub-200 ms in the common case).
- The server is **authoritative** for all game state — clients render, never authoritate.
- Hidden information (each player's hand, identity of the partner before reveal) must never be sent to clients that shouldn't see it.

### 7.2 State stored per active room

- Room code, players (seat, name, connection status), host seat.
- Phase (`lobby` | `bidding` | `trump_partner` | `play` | `end`).
- Per-player hand (server-side only; clients only see their own).
- Bidding state: current high bid, bidder seat, per-seat pass status, bid history (server log; not surfaced to clients).
- Trump suit, called partner card, revealed-partner seat.
- Tricks: completed tricks (cards + winner), current trick state.
- Per-player captured cards (server-side; tallied at end).
- Chat history.

### 7.3 Disconnects & reconnects

- When a player disconnects:
  - Their seat is marked **disconnected** but reserved.
  - The game pauses (no one's clock advances, no auto-actions taken on their behalf).
  - A reconnect window of **60 seconds** is offered to the original player.
  - During the window, the player's seat tile shows `Reconnecting…` (pulsing). The original player can reload `/room/<CODE>` and resume their hand intact.
- After the 60-second window:
  - The host (or any player) can invite a **replacement** via the room link.
  - The replacement joins and inherits the disconnected player's hand and game state.
  - The seat reverts to "filled" and play resumes.
- If the original player reconnects after a replacement has joined: they are bounced to a "this room has been resumed without you" page and may go to the landing page or join another room.

### 7.4 Session identity

- A player is identified by a short-lived session token issued by the server when they first join a room.
- Refreshing the page or losing the tab and returning within the reconnect window should automatically rejoin the same seat with the same hand (no name re-entry required).
- No persistent identity across days or rooms — the token is scoped to the active room session.
- Specific transport / storage mechanism (cookie vs. local storage vs. URL) deferred to the implementation plan.

---

## 8 · Out of Scope (v1)

- **Mobile / touch:** the UI assumes a 1280+ px laptop screen with a mouse cursor. Touch interactions and small-screen layouts deferred.
- **Accounts / login / profiles / stats:** display names only.
- **Cumulative scoring:** each game is independent; no aggregate score across hands.
- **AI / bot players:** no fallback if you can't get 4 humans.
- **Spectators / viewers:** rooms are 4-player only; no observer mode.
- **Voice / video chat:** text-only chat.
- **Public lobbies / matchmaking:** invite-link only.
- **Forced minimum bid if all pass:** if all four players pass without anyone bidding, behavior is undefined for v1 (acceptable since users said someone always bids).
- **Detailed trick history:** only the single most recent completed trick is reviewable.
- **Game replays / archive:** no post-game data retention beyond the in-memory room state.

---

## 9 · Mockups

Designed and validated in the visual brainstorming companion. Source files at `.superpowers/brainstorm/99470-1778624676/content/` (gitignored):

| Phase / Screen                  | File                          |
| ------------------------------- | ----------------------------- |
| In-game table — Layout A        | `cards-design-v2.html`        |
| Bidding panel + statuses        | `bidding-ui.html`             |
| Trump + partner selection       | `trump-partner-v3.html`       |
| Lobby — landing & waiting room  | `lobby-flow-v2.html`          |
| End-of-game results screen      | `end-of-game.html`            |

Earlier iterations of each screen are also retained in the same directory.

---

## 10 · Open Questions / Deferred Decisions

These were intentionally left for the implementation plan or for a later spec revision:

- **Tech stack:** frontend framework, backend framework, real-time transport (WebSocket vs. SSE vs. specific library), hosting provider. Deferred to implementation plan.
- **All-pass edge case in bidding:** if no one ever places a first bid, what happens? Out of scope for v1.
- **Connection-state visualisation:** beyond the "Reconnecting…" tile, do we want signal-strength / latency indicators next to each player? Probably no for v1 — revisit if it's an issue in practice.
- **Card-back theme variants:** v1 ships one card-back design (navy diagonal stripes with ♛ watermark removed). Future cosmetic options possible.
- **Sound effects / audio cues:** not specified for v1. Probably worth adding minimal sounds (card flip, your turn ping) but out of MVP scope.
