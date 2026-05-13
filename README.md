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
