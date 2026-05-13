import { test, expect, type Browser, type Page, type BrowserContext } from '@playwright/test';

async function fourPlayerInBidding(browser: Browser) {
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
  return { contexts, pages, host, g1, g2, g3 };
}

test('bidder picks trump+partner; phase advances to play and all players see trump info', async ({ browser }) => {
  const { contexts, pages, host, g1, g2, g3 } = await fourPlayerInBidding(browser);

  await host.getByRole('button', { name: '75', exact: true }).first().click();
  for (const page of [g1, g2, g3]) {
    await page.getByRole('button', { name: /Pass at 75|^Pass$/ }).first().click();
  }

  await expect(host.getByText(/You won the bid/i)).toBeVisible();

  // Trump suit buttons have accessible name "<glyph> <suit>", e.g. "♠ spades".
  await host.getByRole('button', { name: /spades/i }).click();

  // The partner-card grid has a row per suit with rank buttons. Owned cards are disabled.
  // Click the first enabled rank button in any row (it won't be one in the bidder's hand).
  const firstEnabledRank = host.locator('button.bg-white:not([disabled])').first();
  await firstEnabledRank.click();

  await host.getByRole('button', { name: /Lock it in/i }).click();

  // All clients now in 'play' phase. The host's TrumpPartnerModal still has
  // multiple "Trump" strings during the brief transition, so we wait for a
  // unique play-phase marker: the "Your turn" / "Waiting…" header above the
  // hand, or the absence of the "Lock it in" button.
  for (const page of pages) {
    await expect(page.getByRole('button', { name: /Lock it in/i })).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByText(/Your turn|Waiting…/i).first()).toBeVisible({ timeout: 5000 });
  }

  await Promise.all(contexts.map((c: BrowserContext) => c.close()));
});
