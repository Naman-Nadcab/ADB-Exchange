import { expect, test } from '@playwright/test';

test.describe('Forex chart foundation', () => {
  test('terminal keeps live quote layer and truthful no-history state', async ({ page }) => {
    await page.goto('/forex', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'EDA FOREX' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Simulated · Mock LP')).toBeVisible();
    await expect(page.getByText('Historical Forex OHLC is currently unavailable.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Crypto GET /trading/candles is not used.')).toBeVisible();
    await expect(page.getByText('24h high')).toHaveCount(0);
    await expect(page.getByText('market cap', { exact: false })).toHaveCount(0);
  });
});
