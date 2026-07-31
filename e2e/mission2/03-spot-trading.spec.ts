/**
 * Mission 2 — Spot trading (UI + cross-trade API + order history)
 */
import { test, expect } from '@playwright/test';
import { runPhase3 } from '../api/phase3-spot.test.js';
import { API_BASE, loadCredentials, bearerHeaders, apiKeyHeaders } from './helpers/credentials';

test.describe('Spot trading', () => {
  test('trade terminal loads authenticated', async ({ page }) => {
    await page.goto('/trade/spot');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(2000);
  });

  test('orders UI route', async ({ page }) => {
    await page.goto('/orders/spot');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('API cross-trade: limit sell + market buy + settlement', async () => {
    process.env.E2E_BASE_URL = API_BASE;
    process.env.E2E_TIMEOUT_MS = process.env.E2E_TIMEOUT_MS || '60000';
    process.env.E2E_SPOT_TRADE_SETTLEMENT_MS = process.env.E2E_SPOT_TRADE_SETTLEMENT_MS || '45000';
    const creds = loadCredentials();
    process.env.E2E_JWT = creds.E2E_JWT;
    process.env.E2E_API_KEY = creds.E2E_API_KEY;
    process.env.E2E_COUNTERPARTY_JWT = creds.E2E_COUNTERPARTY_JWT;
    process.env.E2E_SPOT_SYMBOL = process.env.E2E_SPOT_SYMBOL || 'ETH_USDT';
    process.env.E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || creds.E2E_ADMIN_EMAIL || 'admin@example.com';
    process.env.E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || creds.E2E_ADMIN_PASSWORD || 'admin123';

    const { failed, results } = await runPhase3();
    const critical = results.filter((r) => r.startsWith('FAIL:'));
    if (failed > 0) {
      throw new Error(`Phase3 spot cross-trade failed (${failed}):\n${critical.join('\n')}`);
    }
    expect(results.some((r) => r.includes('POST /spot/order'))).toBeTruthy();
  });

  test('API: open orders list', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${API_BASE}/api/v1/spot/open-orders`, {
      headers: apiKeyHeaders(creds.E2E_API_KEY),
    });
    expect(res.ok()).toBeTruthy();
  });

  test('API: order history', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${API_BASE}/api/v1/spot/orders?status=ALL&limit=20`, {
      headers: bearerHeaders(creds.E2E_JWT),
    });
    expect(res.ok()).toBeTruthy();
    const j = (await res.json()) as { success?: boolean };
    expect(j.success).not.toBe(false);
  });

  test('API: trade history', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${API_BASE}/api/v1/spot/trades?market=BTC_USDT&limit=10`, {
      headers: bearerHeaders(creds.E2E_JWT),
    });
    expect(res.ok()).toBeTruthy();
  });
});
