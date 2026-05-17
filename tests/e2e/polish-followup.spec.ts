import { test, expect, type Browser, type BrowserContext } from '@playwright/test';

async function joinRoom(browser: Browser) {
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

  return { contexts, host, pages };
}

async function fourPlayerRoomReady(browser: Browser) {
  const { contexts, host, pages } = await joinRoom(browser);

  await host.getByRole('button', { name: /^Start Game$/ }).click();
  for (const page of pages) {
    await expect(page.getByText(/Bidding phase/i)).toBeVisible();
  }
  return { contexts, host, pages };
}

test('bidding view: body is hidden during deal, then shows BidPanel at center', async ({ browser }) => {
  const { contexts, host } = await joinRoom(browser);

  // Start the game and immediately check the deal animation before "Bidding phase" text appears.
  await host.getByRole('button', { name: /^Start Game$/ }).click();

  // While the deal animation is up, the bid panel should NOT be present.
  await expect(host.getByTestId('deal-animation')).toBeVisible({ timeout: 3000 });
  await expect(host.getByTestId('bid-panel')).toHaveCount(0);

  // Deal completes — overlay disappears, bid panel appears.
  await expect(host.getByTestId('deal-animation')).toHaveCount(0, { timeout: 5000 });
  await expect(host.getByTestId('bid-panel')).toBeVisible();

  // The bid panel is roughly centered horizontally on the viewport.
  const viewport = host.viewportSize();
  expect(viewport).not.toBeNull();
  const box = await host.getByTestId('bid-panel').boundingBox();
  expect(box).not.toBeNull();
  const center = box!.x + box!.width / 2;
  const vCenter = viewport!.width / 2;
  // Allow ±100 px tolerance (panel can sit a touch left/right of dead center).
  expect(Math.abs(center - vCenter)).toBeLessThan(100);

  await Promise.all(contexts.map((c: BrowserContext) => c.close()));
});

test('bidding view: player hand renders 13 xl-size cards (88px wide each)', async ({ browser }) => {
  const { contexts, host } = await fourPlayerRoomReady(browser);

  // Wait for deal to clear so the hand is rendered.
  await expect(host.getByTestId('deal-animation')).toHaveCount(0, { timeout: 5000 });

  // The xl Card has Tailwind class w-[88px]. The player's hand should contain 13 of them.
  const xlCards = host.locator('main .w-\\[88px\\].h-\\[124px\\]');
  await expect(xlCards).toHaveCount(13, { timeout: 3000 });

  await Promise.all(contexts.map((c: BrowserContext) => c.close()));
});

test('played-cards container is 160px (tossed-pile width)', async ({ browser }) => {
  const { contexts, host, pages } = await fourPlayerRoomReady(browser);
  await expect(host.getByTestId('deal-animation')).toHaveCount(0, { timeout: 5000 });

  // Host bids 75; the other 3 pass.
  await host.getByRole('button', { name: '75', exact: true }).first().click();
  for (const page of [pages[1], pages[2], pages[3]]) {
    await page.getByRole('button', { name: /Pass at 75|^Pass$/ }).first().click();
  }

  // Host picks trump + a partner card.
  await expect(host.getByText(/You won the bid/i)).toBeVisible({ timeout: 5000 });
  await host.getByRole('button', { name: /spades/i }).click();
  const firstEnabledRank = host.locator('button.bg-white:not([disabled])').first();
  await firstEnabledRank.click();
  await host.getByRole('button', { name: /Lock it in/i }).click();

  // Wait for play phase on host (Your turn means host leads).
  await expect(host.getByText(/Your turn|Waiting…/i).first()).toBeVisible({ timeout: 5000 });

  // Find whichever client says "Your turn" and play their first card.
  let leader = host;
  for (const p of [host, pages[1], pages[2], pages[3]]) {
    if ((await p.getByText(/Your turn/i).count()) > 0) {
      leader = p;
      break;
    }
  }

  // Wait for leader's turn to be confirmed visible before clicking.
  await expect(leader.getByText(/Your turn/i)).toBeVisible();

  // Click the first xl card twice (stage, then play).
  const firstCard = leader.locator('main .w-\\[88px\\].h-\\[124px\\]').first();
  await firstCard.click({ force: true });
  await firstCard.click({ force: true });

  // Now the played-cards container should be present and 160px wide on the host.
  const center = host.getByTestId('played-cards');
  await expect(center).toBeVisible({ timeout: 6000 });
  const box = await center.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBe(160);

  await Promise.all(contexts.map((c: BrowserContext) => c.close()));
});
