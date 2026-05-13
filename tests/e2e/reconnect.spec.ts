import { test, expect } from '@playwright/test';

test('refreshing the room page preserves your seat (lobby phase)', async ({ browser }) => {
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();

  // Host creates a room
  await p1.goto('/');
  await p1.getByPlaceholder('e.g. Dev').fill('Dev');
  await p1.getByRole('button', { name: /Create a new room/i }).click();
  await expect(p1).toHaveURL(/\/room\/[A-Z]{4}/);
  const roomUrl = p1.url();

  // Guest joins
  await p2.goto(roomUrl);
  await p2.getByPlaceholder('Pick something fun').fill('Sam');
  await p2.getByRole('button', { name: /Join room/i }).click();
  await expect(p2.getByText('Sam').first()).toBeVisible();

  // Refresh the host's tab
  await p1.reload();

  // After reload, host's seat should still be present (the auto-resume happens).
  // The waiting room renders with "Room <CODE>" header and Dev/Sam visible.
  await expect(p1.getByText('Dev').first()).toBeVisible({ timeout: 8000 });
  await expect(p1.getByText('Sam').first()).toBeVisible();
  await expect(p1.getByText(/★ host/i)).toBeVisible();

  await Promise.all([c1.close(), c2.close()]);
});

test('clearing localStorage and revisiting shows the join form again', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto('/');
  await page.getByPlaceholder('e.g. Dev').fill('Dev');
  await page.getByRole('button', { name: /Create a new room/i }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z]{4}/);
  const roomUrl = page.url();

  // Clear localStorage to simulate a "different browser" returning to the URL.
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(roomUrl);

  // Should land on the join form again ("You've been invited to room").
  await expect(page.getByText(/You(’|')ve been invited/i)).toBeVisible();

  await ctx.close();
});
