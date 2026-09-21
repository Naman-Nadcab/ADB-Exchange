import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  AUTH_I18N_ROUTES,
  CUSTOMER_LOCALES,
  I18N_VIEWPORTS,
  PUBLIC_I18N_ROUTES,
  setCustomerLocale,
  type CustomerLocale,
} from './helpers/i18n-locale';
import { loginUserViaUI } from './mission2/helpers/login';
import { loadCredentials, UI_BASE } from './mission2/helpers/credentials';

const BASE = (process.env.BASE_URL ?? UI_BASE).replace(/\/$/, '');
const OUT_DIR = path.join(process.cwd(), '.build', 'i18n-visual-matrix');
const RUN_AUTH = process.env.I18N_VISUAL_AUTH === '1';

type Row = {
  route: string;
  locale: CustomerLocale;
  viewport: string;
  result: 'PASS' | 'FAIL' | 'SKIP';
  httpStatus?: number;
  consoleErrors: string[];
  hydrationWarnings: string[];
  overflowX: boolean;
  note?: string;
};

const RESULTS_FILE = path.join(OUT_DIR, 'results.jsonl');

function appendRow(row: Row) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(RESULTS_FILE, `${JSON.stringify(row)}\n`);
}

function langForLocale(locale: CustomerLocale): string {
  if (locale === 'zh-CN') return 'zh-CN';
  if (locale === 'id-ID') return 'id';
  return 'en';
}

test.describe('Customer i18n visual matrix (public routes)', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  for (const locale of CUSTOMER_LOCALES) {
    for (const vp of I18N_VIEWPORTS) {
      for (const route of PUBLIC_I18N_ROUTES) {
        test(`${route.label} · ${locale} · ${vp.name}`, async ({ browser }) => {
          const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
          await setCustomerLocale(context, locale, BASE);
          const page = await context.newPage();
          const consoleErrors: string[] = [];
          const hydrationWarnings: string[] = [];

          page.on('console', (msg) => {
            const t = msg.text();
            if (msg.type() === 'error') consoleErrors.push(t.slice(0, 500));
            if (/hydration|did not match|Text content does not match/i.test(t)) {
              hydrationWarnings.push(t.slice(0, 500));
            }
          });

          let result: Row['result'] = 'PASS';
          let note: string | undefined;
          let overflowX = false;

          try {
            const res = await page.goto(`${BASE}${route.path}`, {
              waitUntil: 'domcontentloaded',
              timeout: 25_000,
            });
            await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 });
            const lang = await page.locator('html').getAttribute('lang');
            expect(lang, 'html lang').toBe(langForLocale(locale));

            if (route.expectSelector) {
              await expect(page.locator(route.expectSelector).first()).toBeVisible({ timeout: 12_000 });
            }

            overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);

            const shot = path.join(OUT_DIR, `${route.label}_${locale}_${vp.name}.png`);
            await page.screenshot({ path: shot, fullPage: false });

            const criticalConsole = consoleErrors.filter(
              (e) =>
                !/Failed to load resource: the server responded with a status of (404|500)/i.test(e) &&
                !/favicon/i.test(e)
            );
            if (criticalConsole.length > 0) {
              result = 'FAIL';
              note = 'console errors';
            } else if (consoleErrors.length > 0) {
              note = 'api asset 404/500 (frontend-only mode; page rendered)';
            }
          } catch (e) {
            result = 'FAIL';
            note = e instanceof Error ? e.message.slice(0, 200) : String(e);
          }

          appendRow({
            route: route.path,
            locale,
            viewport: vp.name,
            result,
            httpStatus: undefined,
            consoleErrors,
            hydrationWarnings,
            overflowX,
            note,
          });

          await context.close();
          expect(result, note ?? 'route check').toBe('PASS');
        });
      }
    }
  }
});

test.describe('Customer i18n visual matrix (authenticated — optional)', () => {
  test.skip(!RUN_AUTH, 'Set I18N_VISUAL_AUTH=1 and running stack with QA credentials');

  test.beforeAll(async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const creds = loadCredentials();
    if (!creds.QA_TRADER_A_EMAIL || !creds.QA_PASSWORD) {
      test.skip(true, 'QA_TRADER_A_EMAIL / QA_PASSWORD not configured');
    }
  });

  for (const locale of CUSTOMER_LOCALES) {
    test(`auth smoke · ${locale} · 1280x800`, async ({ browser }) => {
      const creds = loadCredentials();
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await setCustomerLocale(context, locale, BASE);
      const page = await context.newPage();
      await loginUserViaUI(page, creds.QA_TRADER_A_EMAIL!, creds.QA_PASSWORD!, BASE);

      for (const route of AUTH_I18N_ROUTES.slice(0, 4)) {
        try {
          await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 25_000 });
          await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 });
          const lang = await page.locator('html').getAttribute('lang');
          expect(lang).toBe(langForLocale(locale));
          appendRow({
            route: route.path,
            locale,
            viewport: '1280x800-auth',
            result: 'PASS',
            consoleErrors: [],
            hydrationWarnings: [],
            overflowX: false,
          });
        } catch (e) {
          appendRow({
            route: route.path,
            locale,
            viewport: '1280x800-auth',
            result: 'FAIL',
            consoleErrors: [],
            hydrationWarnings: [],
            overflowX: false,
            note: e instanceof Error ? e.message.slice(0, 200) : String(e),
          });
        }
      }
      await context.close();
    });
  }
});

test.afterAll(() => {
  if (!fs.existsSync(RESULTS_FILE)) return;
  const rows = fs
    .readFileSync(RESULTS_FILE, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Row);
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    authEnabled: RUN_AUTH,
    total: rows.length,
    pass: rows.filter((r) => r.result === 'PASS').length,
    fail: rows.filter((r) => r.result === 'FAIL').length,
    hydrationIssues: rows.filter((r) => r.hydrationWarnings.length > 0).length,
    overflowCases: rows.filter((r) => r.overflowX).length,
    rows,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(summary, null, 2));
});
