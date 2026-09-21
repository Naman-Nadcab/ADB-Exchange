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
const SUMMARY_JSON = path.join(
  OUT_DIR,
  RUN_AUTH ? 'results-fullstack.json' : 'results.json'
);

function isBenignResourceError(message: string): boolean {
  return (
    /Failed to load resource: the server responded with a status of (404|500)/i.test(message) ||
    /favicon/i.test(message)
  );
}

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
    if (fs.existsSync(RESULTS_FILE)) fs.unlinkSync(RESULTS_FILE);
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

            const criticalConsole = consoleErrors.filter((e) => !isBenignResourceError(e));
            if (criticalConsole.length > 0) {
              result = 'FAIL';
              note = 'console errors';
            } else if (consoleErrors.length > 0) {
              note = RUN_AUTH ? 'benign resource errors only' : 'api asset 404/500 (frontend-only mode; page rendered)';
            }
            if (hydrationWarnings.length > 0) {
              result = 'FAIL';
              note = note ? `${note}; hydration` : 'hydration warnings';
            }
            if (overflowX) {
              result = 'FAIL';
              note = note ? `${note}; horizontal overflow` : 'horizontal overflow';
            }
            if (res && res.status() >= 500) {
              result = 'FAIL';
              note = note ? `${note}; http ${res.status()}` : `http ${res.status()}`;
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
    for (const vp of I18N_VIEWPORTS) {
      test(`auth · ${locale} · ${vp.name}`, async ({ browser }) => {
        const creds = loadCredentials();
        const failures: string[] = [];
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

        await loginUserViaUI(page, creds.QA_TRADER_A_EMAIL!, creds.QA_PASSWORD!, BASE);

        for (const route of AUTH_I18N_ROUTES) {
          let result: Row['result'] = 'PASS';
          let note: string | undefined;
          let overflowX = false;
          const cellConsole: string[] = [];
          const cellHydration: string[] = [];

          try {
            const res = await page.goto(`${BASE}${route.path}`, {
              waitUntil: 'domcontentloaded',
              timeout: 30_000,
            });
            if (page.url().includes('/login')) {
              throw new Error('redirected to login');
            }
            await page.locator('body').waitFor({ state: 'visible', timeout: 12_000 });
            const lang = await page.locator('html').getAttribute('lang');
            if (lang !== langForLocale(locale)) {
              throw new Error(`html lang expected ${langForLocale(locale)} got ${lang}`);
            }

            overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);

            const shot = path.join(OUT_DIR, `auth_${route.label}_${locale}_${vp.name}.png`);
            await page.screenshot({ path: shot, fullPage: false });

            cellConsole.push(...consoleErrors);
            cellHydration.push(...hydrationWarnings);
            consoleErrors.length = 0;
            hydrationWarnings.length = 0;

            const criticalConsole = cellConsole.filter((e) => !isBenignResourceError(e));
            if (criticalConsole.length > 0) {
              result = 'FAIL';
              note = 'console errors';
            }
            if (cellHydration.length > 0) {
              result = 'FAIL';
              note = note ? `${note}; hydration` : 'hydration warnings';
            }
            if (overflowX) {
              result = 'FAIL';
              note = note ? `${note}; horizontal overflow` : 'horizontal overflow';
            }
            if (res && res.status() >= 500) {
              result = 'FAIL';
              note = note ? `${note}; http ${res.status()}` : `http ${res.status()}`;
            }
          } catch (e) {
            result = 'FAIL';
            note = e instanceof Error ? e.message.slice(0, 200) : String(e);
          }

          appendRow({
            route: route.path,
            locale,
            viewport: `${vp.name}-auth`,
            result,
            consoleErrors: cellConsole,
            hydrationWarnings: cellHydration,
            overflowX,
            note,
          });
          if (result === 'FAIL') failures.push(`${route.path}: ${note}`);
        }

        await context.close();
        expect(failures, failures.join('\n')).toHaveLength(0);
      });
    }
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
  fs.writeFileSync(SUMMARY_JSON, JSON.stringify(summary, null, 2));
  if (RUN_AUTH) {
    fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(summary, null, 2));
  }
});
