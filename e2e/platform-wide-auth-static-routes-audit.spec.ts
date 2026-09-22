import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import routes from './helpers/customer-static-routes.json';
import { setCustomerLocale, type CustomerLocale, CUSTOMER_LOCALES } from './helpers/i18n-locale';
import { loginUserForStagingHttp, waitForAuthenticatedRoute } from './mission2/helpers/login';
import { loadCredentials, QA_TRADER_A, QA_PASSWORD } from './mission2/helpers/credentials';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');
const OUT = path.join(process.cwd(), '.build', 'platform-wide-auth-static-routes-audit');

const ZH_FORBIDDEN = ['Create account', 'Log In', 'All Orders', 'Select Payment Method', 'Complete Verification'];

type RouteRow = { path: string; domain: string; auth: string };

function langForLocale(locale: CustomerLocale): string {
  if (locale === 'zh-CN') return 'zh-CN';
  if (locale === 'id-ID') return 'id';
  return 'en';
}

const authRoutes = (routes as RouteRow[]).filter((r) => r.auth === 'auth');

test.describe.configure({ timeout: 600_000, mode: 'serial' });

for (const locale of CUSTOMER_LOCALES) {
  test(`authenticated static routes · ${locale}`, async ({ browser }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const creds = loadCredentials();
    if (!creds.QA_PASSWORD) test.skip(true, 'QA_PASSWORD not configured');

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setCustomerLocale(context, locale, BASE);
    const page = await loginUserForStagingHttp(
      context,
      creds.QA_TRADER_A_EMAIL || QA_TRADER_A,
      creds.QA_PASSWORD || QA_PASSWORD,
      BASE,
      process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000'
    );

    const failures: string[] = [];
    for (const row of authRoutes) {
      try {
        const res = await page.goto(`${BASE}${row.path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await waitForAuthenticatedRoute(page, context);
        if (new URL(page.url()).pathname.startsWith('/login')) {
          failures.push(`${row.path}: redirected to login`);
          continue;
        }
        const lang = await page.locator('html').getAttribute('lang');
        if (lang !== langForLocale(locale)) failures.push(`${row.path}: lang ${lang}`);
        if (res && res.status() >= 500) failures.push(`${row.path}: http ${res.status()}`);
        if (locale === 'zh-CN') {
          const text = await page.evaluate(() => document.body.innerText);
          const hits = ZH_FORBIDDEN.filter((p) => text.includes(p));
          if (hits.length) failures.push(`${row.path}: EN ${hits.join(', ')}`);
        }
        fs.appendFileSync(path.join(OUT, 'results.jsonl'), `${JSON.stringify({ route: row.path, locale, result: 'PASS' })}\n`);
      } catch (e) {
        failures.push(`${row.path}: ${e instanceof Error ? e.message.slice(0, 100) : String(e)}`);
      }
    }
    await context.close();
    fs.writeFileSync(path.join(OUT, `summary_${locale}.json`), JSON.stringify({ locale, failures, pass: authRoutes.length - failures.length }, null, 2));
    expect(failures, failures.slice(0, 20).join('\n')).toEqual([]);
  });
}
