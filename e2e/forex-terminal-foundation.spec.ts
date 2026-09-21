import { expect, test } from '@playwright/test';

test.describe('Forex terminal foundation', () => {
  test('Forex route loads and does not invent candles', async ({ page }) => {
    await page.goto('/forex', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'EDA FOREX' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Historical Forex OHLC is not available/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/GET \/trading\/candles is not used/i)).toBeVisible();
  });

  test('public instruments and quotes hydrate into watchlist', async ({ page }) => {
    await page.goto('/forex', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await expect(page.getByRole('button', { name: /EUR\/USD/i }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('complementary', { name: /market watch/i })).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated private panels stay explicit', async ({ page }) => {
    await page.goto('/forex', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await expect(
      page.getByText(/sign in|log in|登录|Masuk/i).first()
    ).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Crypto spot route still loads', async ({ page }) => {
    await page.goto('/trade/spot', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toMatch(/\/trade\/spot/);
  });
});
