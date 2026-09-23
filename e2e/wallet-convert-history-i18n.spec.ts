import { test, expect } from '@playwright/test';
import { setCustomerLocale, type CustomerLocale } from './helpers/i18n-locale';
import { loginUserForStagingHttp, waitForAuthenticatedRoute } from './mission2/helpers/login';
import { loadCredentials, QA_TRADER_A, QA_PASSWORD } from './mission2/helpers/credentials';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');
const WALLET_EN_LEAKS = [
  'Wallet history',
  'Convert Small Balances',
  'Conversion history',
  'No conversions yet',
  'Get quote',
  'All Transactions',
  'Chain Type',
  'No Data',
  'Date Range',
  'Refresh',
  'Export',
  'Funding Account',
  'Hide zero balances',
  'Wallet balances for deposits',
  'P&L Analysis',
  'All Symbols',
  'No P&L data available',
  'Go to Spot Trading',
  'Cumulative P&L',
  'Best Performer',
  'Worst Performer',
];

const ROUTES = [
  '/wallet/convert',
  '/wallet/history',
  '/wallet/funding',
  '/wallet/pnl',
] as const;

test.describe.configure({ mode: 'serial', timeout: 120_000 });

for (const locale of ['zh-CN', 'id-ID'] as CustomerLocale[]) {
  for (const route of ROUTES) {
    test(`wallet critical · ${route} · ${locale}`, async ({ browser }) => {
      const creds = loadCredentials();
      if (!creds.QA_PASSWORD) test.skip(true, 'QA_PASSWORD not configured');

      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await setCustomerLocale(context, locale, BASE);
      const email = creds.QA_TRADER_A_EMAIL || QA_TRADER_A;
      const password = creds.QA_PASSWORD || QA_PASSWORD;
      const apiBase = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000';
      const page = await loginUserForStagingHttp(context, email, password, BASE, apiBase);

      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await waitForAuthenticatedRoute(page, context);
      await page.locator('html[lang]').waitFor({ state: 'attached', timeout: 15_000 });
      await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });

      const text = await page.evaluate(() => document.body.innerText.slice(0, 12000));
      const hits = WALLET_EN_LEAKS.filter((p) => text.includes(p));
      expect(hits, hits.join(', ')).toEqual([]);

      await context.close();
    });
  }
}
