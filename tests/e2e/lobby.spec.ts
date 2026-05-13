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
  // Note: 'Dev' also appears in a chat message ("Dev created the room"), so we
  // use exact match + .first() to pin to the seat label and avoid strict-mode
  // violations (the chat span uses exact text 'Dev created the room', not 'Dev').
  await expect(host.getByText('Dev', { exact: true }).first()).toBeVisible();
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
