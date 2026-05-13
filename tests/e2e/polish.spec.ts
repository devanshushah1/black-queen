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

  await expect(host.getByTestId('deal-animation')).toBeVisible({ timeout: 1000 });
  await expect(host.getByTestId('deal-animation')).toHaveCount(0, { timeout: 5000 });

  await Promise.all(contexts.map((c: BrowserContext) => c.close()));
});

test('bid panel does not overflow viewport top after a bid is placed', async ({ browser }) => {
  const { contexts, host, pages } = await fourPlayerRoomReady(browser);

  await expect(host.getByTestId('deal-animation')).toHaveCount(0, { timeout: 5000 });

  await host.getByRole('button', { name: '75', exact: true }).first().click();

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
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await host.reload();
  const toggle2 = host.getByTestId('mute-toggle');
  await expect(toggle2).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

  await Promise.all(contexts.map((c: BrowserContext) => c.close()));
});
