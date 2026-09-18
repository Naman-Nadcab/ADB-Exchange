/**
 * Forex Admin UI navigation — loads pages (shell + auth).
 * Uses cert admin credentials; API data depends on admin build pointing at cert API (:4100).
 * Skip heavy mutations; verify navigation and no crash.
 */
import { test, expect } from '@playwright/test';
import { ADMIN_BASE, certAdminUiSession } from './admin-cert-auth';

/** Mirrors `FOREX_ADMIN_ROUTES` in forex-admin-nav.ts (all desk surfaces). */
const FOREX_PATHS = [
  '/forex',
  '/forex/command',
  '/forex/notifications',
  '/forex/compliance',
  '/forex/automation',
  '/forex/instruments',
  '/forex/sessions',
  '/forex/market-data',
  '/forex/orders',
  '/forex/executions',
  '/forex/positions',
  '/forex/protection',
  '/forex/margin-risk',
  '/forex/liquidation',
  '/forex/dealing',
  '/forex/fees-swaps',
  '/forex/accounts',
  '/forex/account-groups',
  '/forex/crm/home',
  '/forex/crm/my-clients',
  '/forex/crm/leads',
  '/forex/crm/clients',
  '/forex/crm/finance',
  '/forex/crm/tasks',
  '/forex/crm/pipeline',
  '/forex/crm/segments',
  '/forex/reporting',
  '/forex/risk-control',
  '/forex/partners',
  '/forex/ledger',
  '/forex/controls',
  '/forex/lp-execution',
  '/forex/liquidity/routing',
  '/forex/integrations',
  '/forex/journal-audit',
  '/forex/system',
];


test.describe('Forex Admin UI navigation', () => {
  test.skip(
    process.env.FOREX_ADMIN_UI_E2E !== '1',
    'Set FOREX_ADMIN_UI_E2E=1 and point admin NEXT_PUBLIC_API_BASE_URL to cert :4100',
  );

  test.beforeEach(async ({ page, request }) => {
    await certAdminUiSession(page, request);
  });

  for (const p of FOREX_PATHS) {
    test(`page loads ${p}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${ADMIN_BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await expect(page.locator('body')).toBeVisible();
      expect(errors.filter((m) => !/hydration/i.test(m))).toEqual([]);
    });
  }
});
