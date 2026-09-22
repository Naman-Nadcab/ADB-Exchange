import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import routes from './helpers/customer-static-routes.json';
import { setCustomerLocale, type CustomerLocale, CUSTOMER_LOCALES } from './helpers/i18n-locale';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');
const OUT = path.join(process.cwd(), '.build', 'platform-wide-static-routes-audit');
const AUTH = process.env.I18N_STATIC_AUTH === '1';

const ZH_FORBIDDEN = [
  'Create account',
  'Log In',
  'Trending Dashboard',
  'Built for precision',
  'Select Payment Method',
  'Mark all read',
  'Complete Verification',
];

type RouteRow = { path: string; domain: string; auth: string };

function langForLocale(locale: CustomerLocale): string {
  if (locale === 'zh-CN') return 'zh-CN';
  if (locale === 'id-ID') return 'id';
  return 'en';
}

const eligible = (routes as RouteRow[]).filter((r) => r.auth !== 'auth' || AUTH);

test.describe.configure({ timeout: 90_000 });

for (const row of eligible) {
  for (const locale of CUSTOMER_LOCALES) {
    test(`${row.path} · ${locale}`, async ({ browser }) => {
      fs.mkdirSync(OUT, { recursive: true });
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await setCustomerLocale(context, locale, BASE);
      const page = await context.newPage();
      const res = await page.goto(`${BASE}${row.path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang, 'html lang').toBe(langForLocale(locale));
      expect(res?.status() ?? 200, 'http status').toBeLessThan(500);
      if (locale === 'zh-CN') {
        const text = await page.evaluate(() => document.body.innerText);
        const hits = ZH_FORBIDDEN.filter((p) => text.includes(p));
        expect(hits, hits.join(', ')).toEqual([]);
      }
      fs.appendFileSync(
        path.join(OUT, 'results.jsonl'),
        `${JSON.stringify({ route: row.path, locale, result: 'PASS', at: new Date().toISOString() })}\n`
      );
      await context.close();
    });
  }
}
