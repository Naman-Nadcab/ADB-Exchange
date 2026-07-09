import type { Page } from '@playwright/test';
import { UI_BASE, ADMIN_UI_BASE } from './credentials';

export async function loginUserViaUI(page: Page, email: string, password: string, base = UI_BASE): Promise<void> {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/(dashboard|trade|wallet|markets|orders)(\/|$|\?)/, { timeout: 30_000 });
}

export async function logoutUserViaUI(page: Page, base = UI_BASE): Promise<void> {
  await page.goto(`${base}/dashboard/account`, { waitUntil: 'domcontentloaded' });
  const logout = page.getByRole('button', { name: /log out|sign out/i });
  if (await logout.count()) {
    await logout.first().click();
    await page.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => {});
    return;
  }
  await page.evaluate(() => {
    localStorage.removeItem('auth-storage');
  });
  await page.goto(`${base}/login`);
}

export async function loginAdminViaUI(page: Page, email: string, password: string, base = ADMIN_UI_BASE): Promise<void> {
  const loginUrl = `${base.replace(/\/$/, '')}/login`;
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  const twofa = page.locator('input[name="twofa"], input[placeholder*="2FA" i], input[placeholder*="authenticator" i]');
  if (await twofa.count()) {
    const code = process.env.E2E_ADMIN_TOTP?.trim();
    if (!code) throw new Error('Admin 2FA required — set E2E_ADMIN_TOTP');
    await twofa.first().fill(code);
  }
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin\/(dashboard|users|orders)/, { timeout: 30_000 });
}
