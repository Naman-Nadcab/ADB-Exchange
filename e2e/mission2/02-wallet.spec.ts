/**
 * Mission 2 — Wallet flows (UI + API)
 */
import { test, expect } from '@playwright/test';
import { API_BASE, loadCredentials, bearerHeaders, apiKeyHeaders } from './helpers/credentials';

test.describe('Wallet — authenticated', () => {
  test('wallet UI loads balances shell', async ({ page }) => {
    await page.goto('/wallet');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(1500);
  });

  test('API: trading balances', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${API_BASE}/api/v1/wallet/balances/trading`, {
      headers: apiKeyHeaders(creds.E2E_API_KEY),
    });
    expect(res.ok()).toBeTruthy();
    const j = (await res.json()) as { success?: boolean; data?: unknown };
    expect(j.success).not.toBe(false);
    expect(j.data).toBeTruthy();
  });

  test('API: deposit history', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${API_BASE}/api/v1/wallet/deposits`, {
      headers: bearerHeaders(creds.E2E_JWT),
    });
    expect(res.ok()).toBeTruthy();
    const j = (await res.json()) as { success?: boolean };
    expect(j.success).not.toBe(false);
  });

  test('API: withdrawal history', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${API_BASE}/api/v1/wallet/withdrawals`, {
      headers: bearerHeaders(creds.E2E_JWT),
    });
    expect(res.ok()).toBeTruthy();
  });

  test('API: internal transfer list', async ({ request }) => {
    const creds = loadCredentials();
    const res = await request.get(`${API_BASE}/api/v1/wallet/internal-transfers`, {
      headers: bearerHeaders(creds.E2E_JWT),
    });
    expect(res.ok()).toBeTruthy();
  });

  test('deposit crypto UI route', async ({ page }) => {
    await page.goto('/wallet/deposit/crypto');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('withdraw crypto UI route', async ({ page }) => {
    await page.goto('/wallet/withdraw/crypto');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('security settings page reachable when authenticated', async ({ page }) => {
    await page.goto('/dashboard/security', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });
});
