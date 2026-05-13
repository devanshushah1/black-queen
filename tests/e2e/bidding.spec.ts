import { test, expect } from '@playwright/test';

async function fourPlayerRoomReady(browser: any) {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map((c: any) => c.newPage()));
  const [host, g1, g2, g3] = pages;

  await host.goto('/');
  await host.getByPlaceholder('e.g. Dev').fill('Dev');
  await host.getByRole('button', { name: /Create a new room/i }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z]{4}/);
  const roomUrl = host.url();

  for (const [page, name] of [
    [g1, 'Sam'],
    [g2, 'Riya'],
    [g3, 'Aman'],
  ] as const) {
    await page.goto(roomUrl);
    await page.getByPlaceholder('Pick something fun').fill(name);
    await page.getByRole('button', { name: /Join room/i }).click();
  }

  await host.getByRole('button', { name: /^Start Game$/ }).click();
  for (const page of pages) {
    await expect(page.getByText(/Bidding phase/i)).toBeVisible();
  }
  return { contexts, pages, host, g1, g2, g3, roomUrl };
}

test('after start, every player sees 13 cards in their hand', async ({ browser }) => {
  const { contexts, pages } = await fourPlayerRoomReady(browser);

  for (const page of pages) {
    // The HandPreview component renders 13 Card visuals (each with a rank corner). Count the
    // total number of card elements visible. Selector: any element with both `rounded-md` AND
    // `bg-white` (the Card visual). Use a more specific selector that the implementation supports.
    const cards = await page.locator('main >> .bg-white.rounded-md').count();
    expect(cards).toBeGreaterThanOrEqual(13);
  }

  await Promise.all(contexts.map((c: any) => c.close()));
});

test('host places a bid, all 4 clients see the new current bid', async ({ browser }) => {
  const { contexts, pages, host } = await fourPlayerRoomReady(browser);

  // Host clicks the bid button for 75 (the first quick-bid since no bid yet).
  await host.getByRole('button', { name: '75', exact: true }).first().click();

  // All clients should see "75" reflected in the current-bid display.
  for (const page of pages) {
    await expect(page.getByText('75', { exact: true }).first()).toBeVisible();
  }

  await Promise.all(contexts.map((c: any) => c.close()));
});

test('after 3 non-bidders pass, phase becomes trump_partner', async ({ browser }) => {
  const { contexts, pages, host, g1, g2, g3 } = await fourPlayerRoomReady(browser);

  await host.getByRole('button', { name: '75', exact: true }).first().click();

  // The 3 non-bidders each click their pass button. The button text is either
  // "Pass at 75" or just "Pass" depending on the BidPanel implementation.
  for (const page of [g1, g2, g3]) {
    await page.getByRole('button', { name: /Pass at 75|^Pass$/ }).first().click();
  }

  // After all 3 pass, the phase advances to trump_partner. The TrumpPartnerView
  // renders a "Trump & partner" header; the bidder additionally sees the picker
  // (with "You won the bid") and others see the waiting screen ("is choosing").
  for (const page of pages) {
    await expect(page.getByText(/Trump (&|and) partner/i)).toBeVisible({ timeout: 5000 });
  }

  await Promise.all(contexts.map((c: any) => c.close()));
});
