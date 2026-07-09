/**
 * Mission 2 — Admin panel (authenticated UI + health API)
 */
import { test, expect } from '@playwright/test';
import { loginAdminViaUI } from './helpers/login';
import { API_BASE, loadCredentials, ADMIN_UI_BASE, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/credentials';

test.describe('Admin panel', () => {
  test.beforeEach(async ({ page }) => {
    const creds = loadCredentials();
    await loginAdminViaUI(
      page,
      creds.E2E_ADMIN_EMAIL || ADMIN_EMAIL,
      creds.E2E_ADMIN_PASSWORD || ADMIN_PASSWORD,
    );
  });

  test('admin dashboard loads', async ({ page }) => {
    await page.goto(`${ADMIN_UI_BASE}/dashboard`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('admin users page', async ({ page }) => {
    await page.goto(`${ADMIN_UI_BASE}/users`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('admin orders page', async ({ page }) => {
    await page.goto(`${ADMIN_UI_BASE}/orders`);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('admin markets page', async ({ page }) => {
    await page.goto(`${ADMIN_UI_BASE}/markets`);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('admin treasury page', async ({ page }) => {
    await page.goto(`${ADMIN_UI_BASE}/treasury`);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('admin system health page', async ({ page }) => {
    await page.goto(`${ADMIN_UI_BASE}/system/health`);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('API: public health endpoint', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.ok()).toBeTruthy();
    const j = (await res.json()) as { status?: string; services?: Record<string, string> };
    expect(j.status).toBe('healthy');
    expect(j.services?.database).toBe('up');
  });

  test('API: admin auth login', async ({ request }) => {
    const creds = loadCredentials();
    const login = await request.post(`${API_BASE}/api/v1/admin/auth/login`, {
      data: {
        email: creds.E2E_ADMIN_EMAIL || ADMIN_EMAIL,
        password: creds.E2E_ADMIN_PASSWORD || ADMIN_PASSWORD,
      },
    });
    expect(login.ok()).toBeTruthy();
    const j = (await login.json()) as { success?: boolean; data?: { accessToken?: string } };
    expect(j.success).toBe(true);
    expect(j.data?.accessToken?.length).toBeGreaterThan(10);
  });
});
