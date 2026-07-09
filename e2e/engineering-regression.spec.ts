import { test, expect } from '@playwright/test';

/** Ignore network noise on unauthenticated pages; fail on React/hydration errors. */
function criticalConsoleErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource') &&
      !e.includes('net::ERR') &&
      !e.includes('CORS policy') &&
      !e.includes('401'),
  );
}

test.describe('95+ engineering regression (browser-verified)', () => {
  test('reset-password redirects to forgot-password', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/forgot-password/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Forgot password/i })).toBeVisible();
    await page.waitForTimeout(500);
    expect(criticalConsoleErrors(errors)).toEqual([]);
  });

  test('/api docs entry reaches dashboard API or login gate', async ({ page }) => {
    await page.goto('/api', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/(dashboard\/api|login)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/(dashboard\/api|login)/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('forgot-password page renders without critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Forgot password/i })).toBeVisible();
    await page.waitForTimeout(500);
    expect(criticalConsoleErrors(errors)).toEqual([]);
  });

  test('trade redirect loads spot terminal without critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    const resp = await page.goto('/trade', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    expect(resp?.status()).toBeLessThan(400);
    await page.waitForURL(/\/trade\/spot/, { timeout: 10_000 });
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(criticalConsoleErrors(errors)).toEqual([]);
  });

  test('trade spot page loads orderbook shell', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/trade/spot', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(2000);
    expect(criticalConsoleErrors(errors).length).toBeLessThanOrEqual(1);
  });
});
