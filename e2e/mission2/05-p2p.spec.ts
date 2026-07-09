/**
 * Mission 2 — P2P flows (browse UI + authenticated API)
 */
import { test, expect } from '@playwright/test';
import { API_BASE, loadCredentials, bearerHeaders } from './helpers/credentials';

test.describe('P2P', () => {
  test('P2P browse UI (public)', async ({ page }) => {
    await page.goto('/p2p');
    await expect(page.locator('body')).toBeVisible();
  });

  test('P2P authenticated my-ads UI', async ({ page }) => {
    await page.goto('/p2p/my-ads');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('API: public ads list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/p2p/ads`);
    expect(res.ok()).toBeTruthy();
    const j = (await res.json()) as { success?: boolean };
    expect(j.success).not.toBe(false);
  });

  test('API: my orders + my ads', async ({ request }) => {
    const creds = loadCredentials();
    const headers = bearerHeaders(creds.E2E_JWT);
    const orders = await request.get(`${API_BASE}/api/v1/p2p/my-orders`, { headers });
    expect(orders.ok()).toBeTruthy();
    const ads = await request.get(`${API_BASE}/api/v1/p2p/my-ads`, { headers });
    expect(ads.ok()).toBeTruthy();
  });

  test('API: payment methods', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${API_BASE}/api/v1/p2p/payment-methods`, {
      headers: bearerHeaders(creds.E2E_JWT),
    });
    expect(res.ok()).toBeTruthy();
  });
});
