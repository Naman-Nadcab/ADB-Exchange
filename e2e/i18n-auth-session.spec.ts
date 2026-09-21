import { test, expect } from '@playwright/test';
import { AUTH_I18N_ROUTES, setCustomerLocale, type CustomerLocale } from './helpers/i18n-locale';
import { loginUserForStagingHttp, waitForAuthenticatedRoute } from './mission2/helpers/login';
import { loadCredentials, QA_TRADER_A, QA_PASSWORD, UI_BASE } from './mission2/helpers/credentials';

const BASE = (process.env.BASE_URL ?? UI_BASE).replace(/\/$/, '');
const API = (process.env.E2E_BASE_URL || process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000').replace(
  /\/$/,
  '',
);

/** Phase 4 deterministic smoke — full domain hop including P2P create-ad / orders. */
const SMOKE_SEQUENCE = [
  '/trade/spot',
  '/forex/trade',
  '/p2p',
  '/p2p/create-ad',
  '/p2p/orders',
  '/dashboard/assets/overview',
  '/dashboard/account',
  ...AUTH_I18N_ROUTES.map((r) => r.path).filter(
    (p) =>
      ![
        '/trade/spot',
        '/forex/trade',
        '/p2p',
        '/p2p/create-ad',
        '/p2p/orders',
        '/dashboard/assets/overview',
        '/dashboard/account',
      ].includes(p),
  ),
];

test.describe('I18n auth session smoke', () => {
  test.skip(!process.env.I18N_VISUAL_AUTH, 'Set I18N_VISUAL_AUTH=1');

  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  for (let run = 1; run <= 3; run++) {
    test(`run ${run}: session survives locale hops and full auth route loop`, async ({ browser }) => {
      const creds = loadCredentials();
      const locales: CustomerLocale[] = ['en', 'zh-CN', 'id-ID', 'en'];
      const logoutUrls: string[] = [];

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
        page.on('request', (req) => {
          const u = req.url();
          if (/\/api\/v1\/auth\/(logout|revoke)/i.test(u)) logoutUrls.push(u);
        });

        for (const route of SMOKE_SEQUENCE) {
          await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          await waitForAuthenticatedRoute(page, context);
          const pathname = new URL(page.url()).pathname;
          expect(pathname.startsWith('/login'), `${route} redirected to login`).toBe(false);
        }
        await context.close();
      }
      expect(logoutUrls, 'unexpected auth logout API during smoke').toEqual([]);
    });
  }
});
