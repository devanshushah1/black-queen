import { test, expect, type Page } from '@playwright/test';

/** Click the first enabled card in the player's hand. Returns true if clicked. */
async function playFirstLegalCard(page: Page): Promise<boolean> {
  // The hand cards are inside the PlayerHand component; legal cards have
  // .cursor-pointer (not .cursor-not-allowed). Illegal cards have opacity-30.
  // Cards overlap with negative margins + rotation; the center suit-glyph child
  // can intercept pointer events. To bypass all of that, dispatch the click
  // directly on the DOM element via evaluate(). The PlayerHand handleClick
  // stages on the first call and plays on the second.
  const cards = page.locator('main >> div.cursor-pointer:not(.opacity-30)');
  const count = await cards.count();
  if (count === 0) return false;
  const handle = await cards.first().elementHandle();
  if (!handle) return false;
  // First click: stage.
  await handle.evaluate((el: Element) => (el as HTMLElement).click());
  // Wait briefly for React state update + the pill to appear.
  await page.waitForTimeout(50);
  // Second click: play. Use the same element handle so React sees a click on
  // the *same* stagedKey card.
  await handle.evaluate((el: Element) => (el as HTMLElement).click());
  return true;
}

test('drives 13 tricks to the end-of-game screen', async ({ browser }) => {
  test.setTimeout(180_000); // up to 3 minutes for 52 plays

  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [host, g1, g2, g3] = pages;

  // Setup
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

  // Bidding: host bids 75, others pass.
  await host.getByRole('button', { name: '75', exact: true }).first().click();
  for (const page of [g1, g2, g3]) {
    await page.getByRole('button', { name: /Pass at 75|^Pass$/ }).first().click();
  }

  // Trump-partner: host picks spades + first enabled rank.
  await expect(host.getByText(/You won the bid/i)).toBeVisible();
  await host.getByRole('button', { name: /spades/i }).click();
  await host.locator('button.bg-white:not([disabled])').first().click();
  await host.getByRole('button', { name: /Lock it in/i }).click();

  // Wait for play phase.
  for (const page of pages) {
    await expect(page.getByRole('button', { name: /Lock it in/i })).toHaveCount(0, { timeout: 5000 });
  }

  // Drive 13 tricks (52 plays). For each play, find the page showing "Your turn"
  // and have it click a card.
  for (let i = 0; i < 52; i++) {
    let played = false;
    // Try a few times to find whoever has "Your turn" — broadcasts may take a moment.
    for (let attempt = 0; attempt < 40 && !played; attempt++) {
      for (const page of pages) {
        const yourTurn = await page.getByText(/Your turn/i).count();
        if (yourTurn > 0) {
          await playFirstLegalCard(page);
          played = true;
          break;
        }
      }
      if (!played) await pages[0].waitForTimeout(150);
    }
    if (!played) {
      // No one shows "Your turn" after multiple attempts — phase has changed.
      break;
    }
    // Small settle between plays so the broadcast can propagate.
    await pages[0].waitForTimeout(150);
  }

  // All clients should now be at the end screen.
  for (const page of pages) {
    await expect(page.getByText(/YOU WON|YOU LOST/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Bidder team needed/i)).toBeVisible();
  }

  // Host sees "Play again" button.
  await expect(host.getByRole('button', { name: /Play again — same seats/i })).toBeVisible();

  await Promise.all(contexts.map((c) => c.close()));
});
