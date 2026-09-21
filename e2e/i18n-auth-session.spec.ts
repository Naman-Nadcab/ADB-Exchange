import { test, expect } from '@playwright/test';
import { setCustomerLocale, type CustomerLocale } from './helpers/i18n-locale';
import { loginUserForStagingHttp } from './mission2/helpers/login';
import { loadCredentials, QA_TRADER_A, QA_PASSWORD } from './mission2/helpers/credentials';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');
const API = (process.env.E2E_BASE_URL || process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

const SMOKE_ROUTES = ['/trade/spot', '/p2p', '/dashboard/assets/overview', '/dashboard/account', '/forex/trade'];

test.describe('I18n auth session smoke', () => {
  test.skip(!process.env.I18N_VISUAL_AUTH, 'Set I18N_VISUAL_AUTH=1');

  test('session survives locale switches and domain hops', async ({ browser }) => {
    const creds = loadCredentials();
    const locales: CustomerLocale[] = ['en', 'zh-CN', 'id-ID', 'en'];
    for (const locale of locales) {
      const context = await browser.newContext();
      await setCustomerLocale(context, locale, BASE);
      const page = await loginUserForStagingHttp(
        context,
        creds.QA_TRADER_A_EMAIL || QA_TRADER_A,
        creds.QA_PASSWORD || QA_PASSWORD,
        BASE,
        API,
      );
      for (const route of SMOKE_ROUTES) {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        const pathname = new URL(page.url()).pathname;
        expect(pathname.startsWith('/login'), `${route} redirected to login`).toBe(false);
      }
      await context.close();
    }
  });
});
