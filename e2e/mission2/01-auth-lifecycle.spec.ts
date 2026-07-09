/**
 * Mission 2 — Auth lifecycle: guest → login → JWT → refresh → session restore → logout → re-login
 */
import { test, expect } from '@playwright/test';
import { loginUserViaUI } from './helpers/login';
import {
  API_BASE,
  loadCredentials,
  QA_TRADER_A,
  QA_PASSWORD,
  bearerHeaders,
} from './helpers/credentials';

test.describe.configure({ mode: 'serial' });

test('guest is redirected from protected wallet route', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
});

test('password login establishes session and JWT', async ({ page, request }) => {
  const creds = loadCredentials();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('401') && !m.text().includes('Failed to load resource')) {
      errors.push(m.text());
    }
  });

  await loginUserViaUI(page, creds.QA_TRADER_A_EMAIL || QA_TRADER_A, creds.QA_PASSWORD || QA_PASSWORD);
  await expect(page.locator('body')).toBeVisible();

  const authStorage = await page.evaluate(() => localStorage.getItem('auth-storage'));
  expect(authStorage).toBeTruthy();

  const jwt = creds.E2E_JWT;
  expect(jwt.length).toBeGreaterThan(20);

  const me = await request.get(`${API_BASE}/api/v1/auth/me`, { headers: bearerHeaders(jwt) });
  expect(me.ok()).toBeTruthy();
  const body = (await me.json()) as { success?: boolean; data?: { email?: string } };
  expect(body.success).toBe(true);
  expect(body.data?.email?.toLowerCase()).toContain('qa_trader_a');

  expect(errors.filter((e) => e.includes('hydration') || e.includes('React'))).toEqual([]);
});

test('refresh token returns new access token', async ({ request }) => {
  const creds = loadCredentials();
  const login = await request.post(`${API_BASE}/api/v1/auth/login/password`, {
    data: {
      email: creds.QA_TRADER_A_EMAIL || QA_TRADER_A,
      password: creds.QA_PASSWORD || QA_PASSWORD,
    },
  });
  expect(login.ok()).toBeTruthy();
  const lj = (await login.json()) as { success?: boolean; data?: { refreshToken?: string } };
  expect(lj.data?.refreshToken?.length).toBeGreaterThan(20);

  const refresh = await request.post(`${API_BASE}/api/v1/auth/refresh`, {
    data: { refreshToken: lj.data!.refreshToken },
  });
  expect(refresh.ok()).toBeTruthy();
  const j = (await refresh.json()) as { success?: boolean; data?: { accessToken?: string } };
  expect(j.success).toBe(true);
  expect(j.data?.accessToken?.length).toBeGreaterThan(20);
});

test('session restore after reload', async ({ page, request }) => {
  const creds = loadCredentials();
  await loginUserViaUI(page, creds.QA_TRADER_A_EMAIL || QA_TRADER_A, creds.QA_PASSWORD || QA_PASSWORD);
  await page.goto('/wallet', { waitUntil: 'networkidle' });
  const url = page.url();
  await page.goto(url, { waitUntil: 'networkidle' });
  await expect(page).not.toHaveURL(/\/login/);
  const me = await request.get(`${API_BASE}/api/v1/auth/me`, { headers: bearerHeaders(creds.E2E_JWT) });
  expect(me.ok()).toBeTruthy();
});

test('logout revokes disposable session (API)', async ({ request }) => {
  const creds = loadCredentials();
  const login = await request.post(`${API_BASE}/api/v1/auth/login/password`, {
    data: {
      email: creds.QA_TRADER_A_EMAIL || QA_TRADER_A,
      password: creds.QA_PASSWORD || QA_PASSWORD,
    },
  });
  expect(login.ok()).toBeTruthy();
  const lj = (await login.json()) as { data?: { accessToken?: string } };
  const tempJwt = lj.data?.accessToken ?? '';
  expect(tempJwt.length).toBeGreaterThan(20);

  const logout = await request.post(`${API_BASE}/api/v1/auth/logout`, {
    headers: bearerHeaders(tempJwt),
  });
  expect(logout.ok()).toBeTruthy();

  const me = await request.get(`${API_BASE}/api/v1/auth/me`, { headers: bearerHeaders(tempJwt) });
  expect(me.status()).toBe(401);
});

test('login again after logout', async ({ page }) => {
  const creds = loadCredentials();
  await loginUserViaUI(page, creds.QA_TRADER_A_EMAIL || QA_TRADER_A, creds.QA_PASSWORD || QA_PASSWORD);
  await expect(page).not.toHaveURL(/\/login$/);
});

test('forgot-password page renders', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
});
