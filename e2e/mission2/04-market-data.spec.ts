/**
 * Mission 2 — Market data (UI + public API)
 */
import { test, expect } from '@playwright/test';
import { API_BASE } from './helpers/credentials';

test.describe('Market data', () => {
  test('markets page renders', async ({ page }) => {
    await page.goto('/markets');
    await expect(page.locator('body')).toBeVisible();
  });

  test('API: spot markets list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/spot/markets`);
    expect(res.ok()).toBeTruthy();
    const j = (await res.json()) as { success?: boolean; data?: unknown[] };
    expect(j.success).toBe(true);
    expect(Array.isArray(j.data)).toBe(true);
    expect((j.data ?? []).length).toBeGreaterThan(0);
  });

  test('API: orderbook BTC_USDT', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/spot/orderbook/BTC_USDT?limit=20`);
    expect(res.ok()).toBeTruthy();
    const j = (await res.json()) as { success?: boolean; data?: { bids?: unknown[]; asks?: unknown[] } };
    expect(j.success).toBe(true);
    expect(Array.isArray(j.data?.bids)).toBe(true);
    expect(Array.isArray(j.data?.asks)).toBe(true);
  });

  test('API: recent trades (public tape)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/spot/recent-trades/BTC_USDT?limit=5`);
    expect(res.ok()).toBeTruthy();
  });

  test('trade terminal shows chart area', async ({ page }) => {
    await page.goto('/trade/spot');
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForTimeout(3000);
    const main = page.locator('#main-content, main').first();
    await expect(main).toBeVisible();
  });
});
