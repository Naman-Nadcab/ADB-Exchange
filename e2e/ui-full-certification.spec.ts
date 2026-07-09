/**
 * MISSION 1 — Full browser UI certification (read-only audit).
 * Run: BASE_URL=http://127.0.0.1 ADMIN_BASE_URL=http://127.0.0.1/admin SKIP_WEBSERVER=1 npx playwright test e2e/ui-full-certification.spec.ts
 */
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1';
const ADMIN_BASE = process.env.ADMIN_BASE_URL ?? 'http://127.0.0.1/admin';

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

type RouteEntry = { app: string; path: string; fullPath: string };

type PageResult = {
  url: string;
  app: string;
  viewport: string;
  finalUrl: string;
  httpOk: boolean;
  bodyVisible: boolean;
  consoleErrors: string[];
  criticalErrors: string[];
  hydrationErrors: string[];
  reactErrors: string[];
  overflow: boolean;
  buttonsFound: number;
  buttonsClicked: number;
  buttonClickFailures: string[];
  formsFound: number;
  passed: boolean;
  failReason?: string;
};

const discovered = JSON.parse(
  readFileSync(join(process.cwd(), 'e2e', 'routes-discovered.json'), 'utf8'),
) as { userRoutes: RouteEntry[]; adminRoutes: RouteEntry[] };

const allRoutes: Array<RouteEntry & { base: string }> = [
  ...discovered.userRoutes.map((r) => ({ ...r, base: BASE })),
  ...discovered.adminRoutes.map((r) => ({ ...r, base: ADMIN_BASE.replace(/\/$/, '') })),
];

const results: PageResult[] = [];

function isBenignConsole(msg: string): boolean {
  return (
    msg.includes('favicon') ||
    msg.includes('Failed to load resource') ||
    msg.includes('net::ERR') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('404') ||
    msg.includes('CORS policy') ||
    msg.includes('ChunkLoadError') === false && msg.includes('Loading chunk')
  );
}

function classifyConsole(messages: ConsoleMessage[]) {
  const errors = messages.filter((m) => m.type() === 'error').map((m) => m.text());
  const hydration = errors.filter((e) => /hydration|did not match|Text content does not match/i.test(e));
  const react = errors.filter((e) => /React|Minified React error|Maximum update depth/i.test(e));
  const critical = errors.filter((e) => !isBenignConsole(e) && !hydration.some((h) => h === e));
  return { errors, hydration, react, critical };
}

/** Wait until shell is painted — login gate, trade terminal, or generic body. */
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  const url = page.url();
  if (url.includes('/login')) {
    await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
    await page
      .getByRole('heading', { name: /sign in|log in|welcome/i })
      .or(page.locator('form input').first())
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => page.locator('body').waitFor({ state: 'visible', timeout: 5_000 }));
  } else {
    await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#main-content, main, [role="main"]').first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
}

async function auditPage(
  page: Page,
  route: RouteEntry & { base: string },
  viewport: (typeof VIEWPORTS)[number],
): Promise<PageResult> {
  const target = `${route.base}${route.path === '/admin' ? '' : route.path}`.replace(/([^:]\/)\/+/g, '$1');
  const consoleMsgs: ConsoleMessage[] = [];
  page.on('console', (m) => consoleMsgs.push(m));

  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  let httpOk = false;
  let bodyVisible = false;
  let overflow = false;
  let buttonsFound = 0;
  let buttonsClicked = 0;
  const buttonClickFailures: string[] = [];
  let formsFound = 0;

  try {
    const resp = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    httpOk = resp ? resp.status() < 500 : false;
    await waitForPageReady(page);
    bodyVisible = await page.locator('body').isVisible();

    overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });

    buttonsFound = await page.locator('button:visible, [role="button"]:visible').count();
    formsFound = await page.locator('form:visible').count();

    const safeButtons = page.locator(
      'button:visible, [role="button"]:visible',
    );
    const limit = Math.min(await safeButtons.count(), 8);
    for (let i = 0; i < limit; i++) {
      const btn = safeButtons.nth(i);
      const text = ((await btn.textContent()) ?? '').toLowerCase();
      if (/delete|remove|withdraw|submit order|place order|confirm pay|logout|sign out|cancel all/i.test(text)) {
        continue;
      }
      try {
        await btn.click({ timeout: 2000 });
        buttonsClicked++;
        await page.waitForTimeout(300);
        if (await page.locator('[role="dialog"], [role="alertdialog"]').count()) {
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(200);
        }
      } catch (e) {
        buttonClickFailures.push(text.slice(0, 40) || `btn-${i}`);
      }
    }
  } catch (e) {
    const { errors, hydration, react, critical } = classifyConsole(consoleMsgs);
    return {
      url: target,
      app: route.app,
      viewport: viewport.name,
      finalUrl: page.url(),
      httpOk,
      bodyVisible,
      consoleErrors: errors,
      criticalErrors: critical,
      hydrationErrors: hydration,
      reactErrors: react,
      overflow,
      buttonsFound,
      buttonsClicked,
      buttonClickFailures,
      formsFound,
      passed: false,
      failReason: e instanceof Error ? e.message : String(e),
    };
  }

  const { errors, hydration, react, critical } = classifyConsole(consoleMsgs);
  const passed =
    bodyVisible &&
    httpOk &&
    critical.length === 0 &&
    hydration.length === 0 &&
    react.length === 0 &&
    !overflow;

  return {
    url: target,
    app: route.app,
    viewport: viewport.name,
    finalUrl: page.url(),
    httpOk,
    bodyVisible,
    consoleErrors: errors,
    criticalErrors: critical,
    hydrationErrors: hydration,
    reactErrors: react,
    overflow,
    buttonsFound,
    buttonsClicked,
    buttonClickFailures,
    formsFound,
    passed,
    failReason: passed
      ? undefined
      : [
          !bodyVisible && 'body not visible',
          !httpOk && 'HTTP 5xx',
          critical.length && `critical console (${critical.length})`,
          hydration.length && `hydration (${hydration.length})`,
          react.length && `react (${react.length})`,
          overflow && 'horizontal overflow',
        ]
          .filter(Boolean)
          .join('; '),
  };
}

test.describe.configure({ mode: 'serial', timeout: 600_000 });

for (const viewport of VIEWPORTS) {
  test.describe(`Viewport: ${viewport.name}`, () => {
    for (const route of allRoutes) {
      const label = `${route.app}${route.path || '/'}`.slice(0, 80);
      test(`${label}`, async ({ page }) => {
        const r = await auditPage(page, route, viewport);
        results.push(r);
        expect(r.passed, r.failReason ?? `failed: ${r.url} @ ${viewport.name}`).toBe(true);
      });
    }
  });
}

test.afterAll(async () => {
  mkdirSync(join(process.cwd(), 'e2e', 'reports'), { recursive: true });
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  const uniquePages = new Set(results.map((r) => `${r.app}:${r.url.split('?')[0]}`));
  const pagesPassed = new Set(results.filter((r) => r.passed).map((r) => `${r.app}:${r.url.split('?')[0]}`));

  const summary = {
    auditedAt: new Date().toISOString(),
    totalChecks: results.length,
    uniqueRoutes: uniquePages.size,
    passedChecks: passed,
    failedChecks: failed.length,
    uiCoveragePct: Math.round((pagesPassed.size / uniquePages.size) * 1000) / 10,
    buttonsVerified: results.reduce((s, r) => s + r.buttonsClicked, 0),
    buttonsFound: results.reduce((s, r) => s + r.buttonsFound, 0),
    formsFound: results.reduce((s, r) => s + r.formsFound, 0),
    consoleErrorCount: results.reduce((s, r) => s + r.criticalErrors.length, 0),
    hydrationErrorCount: results.reduce((s, r) => s + r.hydrationErrors.length, 0),
    overflowCount: results.filter((r) => r.overflow).length,
    failures: failed.slice(0, 100).map((f) => ({
      url: f.url,
      viewport: f.viewport,
      reason: f.failReason,
      critical: f.criticalErrors.slice(0, 3),
      hydration: f.hydrationErrors.slice(0, 2),
    })),
    allResults: results,
  };

  writeFileSync(
    join(process.cwd(), 'e2e', 'reports', 'ui-certification-report.json'),
    JSON.stringify(summary, null, 2),
  );
});
