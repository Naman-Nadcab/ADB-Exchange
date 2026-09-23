import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import routes from './helpers/customer-static-routes.json';
import { setCustomerLocale, CUSTOMER_LOCALES, type CustomerLocale } from './helpers/i18n-locale';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');
const OUT = path.join(process.cwd(), '.build', 'i18n-deep-forensic-rendered-results.jsonl');

const FORBIDDEN_PHRASES = [
  'Create account',
  'Log In',
  'Trending Dashboard',
  'Built for precision',
  'Customer command center',
  'Select Payment Method',
  'Complete Verification',
  'Search pair',
  'No pairs found',
  'Switch product',
  'Just now',
  'Mark all read',
  '+ Create demo account',
  'Open trade terminal',
  'Loading quote…',
  'Insufficient history',
  'Wallet history',
  'Convert Small Balances',
  'Conversion history',
  'No conversions yet',
  'Get quote',
  'All Transactions',
  'Chain Type',
  'No Data',
  'Date Range',
];

type RouteRow = { path: string; auth: string };

function langForLocale(locale: CustomerLocale): string {
  if (locale === 'zh-CN') return 'zh-CN';
  if (locale === 'id-ID') return 'id';
  return 'en';
}

function unexpectedEnglish(text: string, locale: CustomerLocale): string[] {
  if (locale === 'en') return [];
  return FORBIDDEN_PHRASES.filter((p) => text.includes(p));
}

const publicRoutes = (routes as RouteRow[]).filter((r) => r.auth === 'public');

test.describe.configure({ timeout: 90_000 });

for (const row of publicRoutes) {
  for (const locale of CUSTOMER_LOCALES) {
    test(`deep forensic · ${row.path} · ${locale}`, async ({ browser }) => {
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await setCustomerLocale(context, locale, BASE);
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const hydrationWarnings: string[] = [];
      page.on('console', (msg) => {
        const t = msg.text();
        if (msg.type() === 'error') consoleErrors.push(t.slice(0, 300));
        if (/hydration|did not match|MISSING_MESSAGE/i.test(t)) hydrationWarnings.push(t.slice(0, 300));
      });

      let status: 'PASS' | 'FAIL' = 'PASS';
      let unexpected: string[] = [];
      try {
        await page.goto(`${BASE}${row.path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
        const lang = await page.locator('html').getAttribute('lang');
        if (lang !== langForLocale(locale)) status = 'FAIL';
        const sample = await page.evaluate(() => document.body.innerText.slice(0, 8000));
        unexpected = unexpectedEnglish(sample, locale);
        if (unexpected.length) status = 'FAIL';
      } catch (e) {
        status = 'FAIL';
        unexpected = [e instanceof Error ? e.message.slice(0, 120) : String(e)];
      }

      fs.appendFileSync(
        OUT,
        `${JSON.stringify({
          route: row.path,
          locale,
          viewport: '1440x900',
          status,
          unexpectedEnglish: unexpected,
          missingTranslation: [],
          consoleErrors: consoleErrors.slice(0, 3),
          missingKeys: hydrationWarnings.filter((h) => /MISSING_MESSAGE/i.test(h)).slice(0, 3),
        })}\n`
      );

      expect(status, `${row.path} ${locale}: ${unexpected.join('; ')}`).toBe('PASS');
      await context.close();
    });
  }
}
