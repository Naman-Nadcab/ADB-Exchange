import { expect, test } from '@playwright/test';

test.describe('Forex product discovery', () => {
  test('Home exposes Open Forex and Trade Spot as equal products', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Choose a market' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Open Forex' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Trade Spot' }).first()).toBeVisible();
  });

  test('Home Open Forex goes to /forex', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.getByRole('link', { name: 'Open Forex' }).click();
    await expect(page).toHaveURL(/\/forex/, { timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'EDA FOREX' })).toBeVisible();
    await expect(page.getByText('Simulated · Mock LP')).toBeVisible();
  });

  test('Forex product switcher returns to Crypto Spot', async ({ page }) => {
    await page.goto('/forex', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.getByRole('navigation', { name: 'Product' }).getByRole('link', { name: 'Crypto Spot' }).click();
    await expect(page).toHaveURL(/\/trade\/spot/, { timeout: 10_000 });
  });

  test('Forex trade alias loads', async ({ page }) => {
    await page.goto('/forex/trade', { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await expect(page.getByRole('link', { name: 'EDA FOREX' })).toBeVisible({ timeout: 10_000 });
  });
});
