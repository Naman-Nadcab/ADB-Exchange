import { test, expect } from '@playwright/test';
import path from 'node:path';
import { loginUserViaUI, loginAdminViaUI } from './helpers/login';
import { loadCredentials, QA_TRADER_A, QA_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/credentials';

const authDir = path.join(process.cwd(), 'e2e', '.auth');

test.describe('Mission 2 — auth storage setup', () => {
  test('trader A session', async ({ page }) => {
    const creds = loadCredentials();
    await loginUserViaUI(page, creds.QA_TRADER_A_EMAIL || QA_TRADER_A, creds.QA_PASSWORD || QA_PASSWORD);
    await page.context().storageState({ path: path.join(authDir, 'trader-a.json') });
  });

  test('trader B session', async ({ page }) => {
    const creds = loadCredentials();
    await loginUserViaUI(page, creds.QA_TRADER_B_EMAIL || 'qa_trader_b@local.exchange', creds.QA_PASSWORD || QA_PASSWORD);
    await page.context().storageState({ path: path.join(authDir, 'trader-b.json') });
  });

  test('admin session', async ({ page }) => {
    const creds = loadCredentials();
    await loginAdminViaUI(
      page,
      creds.E2E_ADMIN_EMAIL || ADMIN_EMAIL,
      creds.E2E_ADMIN_PASSWORD || ADMIN_PASSWORD,
    );
    await page.context().storageState({ path: path.join(authDir, 'admin.json') });
  });
});
