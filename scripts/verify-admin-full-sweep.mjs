#!/usr/bin/env node
/**
 * Phase 1.1 — Full admin panel sweep: every nav route, safe button clicks, screenshots, traces.
 * Run: OUT_DIR=/opt/m-live/docs/verification-admin-sweep node scripts/verify-admin-full-sweep.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.OUT_DIR || '/opt/m-live/docs/verification-admin-sweep';
const BASE = (process.env.ADMIN_BASE || 'http://109.123.254.30/admin').replace(/\/$/, '');
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
const PASS = process.env.E2E_ADMIN_PASSWORD || 'admin123';
const SKIP_DESTRUCTIVE = process.env.SKIP_DESTRUCTIVE !== '0';

mkdirSync(join(OUT, 'screenshots'), { recursive: true });
mkdirSync(join(OUT, 'traces'), { recursive: true });

const discovered = JSON.parse(readFileSync(join(process.cwd(), 'e2e', 'routes-discovered.json'), 'utf8'));
const routes = [...new Set(discovered.adminRoutes.map((r) => r.fullPath || r.path.replace(/^\/admin/, '') || '/'))]
  .filter(Boolean)
  .sort();

const DESTRUCTIVE = /delete|remove|withdraw|submit order|place order|confirm pay|logout|sign out|cancel all|execute action|pause all|halt|freeze|emergency/i;

const matrix = [];

function slug(path) {
  return path.replace(/\//g, '_').replace(/^_/, '') || 'dashboard';
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('input[type=email], input[name=email]').first().fill(EMAIL);
  await page.locator('input[type=password]').first().fill(PASS);
  await page.locator('button[type=submit]').first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function auditRoute(browser, routePath, storageState) {
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const url = path === '/' ? `${BASE}/dashboard` : `${BASE}${path}`;
  const name = slug(path);
  const row = {
    route: path,
    url,
    httpOk: false,
    bodyVisible: false,
    consoleCritical: [],
    buttonsFound: 0,
    buttonsClicked: 0,
    modalsOpened: 0,
    buttonFailures: [],
    screenshot: '',
    trace: '',
    pass: false,
    failReason: '',
  };

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await context.tracing.start({ screenshots: true, snapshots: true });

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    row.httpOk = resp ? resp.status() < 500 : false;
    await page.locator('body').waitFor({ state: 'attached', timeout: 15_000 });
    row.bodyVisible = await page.locator('#main-content, main, [role="main"], body').first().isVisible();

    if (page.url().includes('/login')) {
      row.failReason = 'redirected to login';
      return row;
    }

    const buttons = page.locator('button:visible, [role="button"]:visible');
    row.buttonsFound = await buttons.count();
    const limit = Math.min(row.buttonsFound, 12);
    for (let i = 0; i < limit; i++) {
      const btn = buttons.nth(i);
      const text = ((await btn.textContent()) ?? '').trim();
      if (SKIP_DESTRUCTIVE && DESTRUCTIVE.test(text)) continue;
      try {
        await btn.click({ timeout: 2500 });
        row.buttonsClicked++;
        await page.waitForTimeout(350);
        const dialogs = await page.locator('[role="dialog"], [role="alertdialog"]').count();
        if (dialogs > 0) {
          row.modalsOpened++;
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(200);
        }
      } catch {
        row.buttonFailures.push(text.slice(0, 48) || `btn-${i}`);
      }
    }

    row.consoleCritical = consoleErrors.filter(
      (e) => !/favicon|Failed to load resource|net::ERR|401|403|404/i.test(e),
    );
    row.screenshot = join(OUT, 'screenshots', `${name}.png`);
    await page.screenshot({ path: row.screenshot, fullPage: true });

    row.pass =
      row.httpOk &&
      row.bodyVisible &&
      row.consoleCritical.length === 0 &&
      !page.url().includes('/login');
    if (!row.pass && !row.failReason) {
      row.failReason =
        !row.httpOk ? 'HTTP 5xx' :
        row.consoleCritical.length ? `console: ${row.consoleCritical[0].slice(0, 80)}` :
        'unknown';
    }
  } catch (e) {
    row.failReason = e instanceof Error ? e.message : String(e);
    row.screenshot = join(OUT, 'screenshots', `${name}-error.png`);
    await page.screenshot({ path: row.screenshot, fullPage: true }).catch(() => {});
  } finally {
    row.trace = join(OUT, 'traces', `${name}.zip`);
    await context.tracing.stop({ path: row.trace }).catch(() => {});
    await context.close();
  }
  return row;
}

async function main() {
  mkdirSync(join(OUT, 'screenshots'), { recursive: true });
  mkdirSync(join(OUT, 'traces'), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const loginContext = await browser.newContext();
  const loginPage = await loginContext.newPage();
  await login(loginPage);
  const storagePath = join(OUT, 'admin-auth.json');
  await loginContext.storageState({ path: storagePath });
  await loginContext.close();

  for (const route of routes) {
    process.stdout.write(`Sweep ${route}… `);
    const row = await auditRoute(browser, route, storagePath);
    matrix.push(row);
    console.log(row.pass ? 'PASS' : `FAIL (${row.failReason})`);
  }
  await browser.close();

  const passed = matrix.filter((r) => r.pass).length;
  const failed = matrix.length - passed;
  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    routesTotal: matrix.length,
    passed,
    failed,
    verdict: failed === 0 ? 'PASS' : 'FAIL',
    matrix,
  };

  writeFileSync(join(OUT, 'matrix.json'), JSON.stringify(report, null, 2));
  const md = [
    '# Admin Full Sweep Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `**Verdict: ${report.verdict}** — ${passed}/${matrix.length} routes passed`,
    '',
    '| Route | HTTP | Buttons | Modals | Console | Result |',
    '|-------|------|---------|--------|---------|--------|',
    ...matrix.map((r) =>
      `| ${r.route} | ${r.httpOk ? 'ok' : 'fail'} | ${r.buttonsClicked}/${r.buttonsFound} | ${r.modalsOpened} | ${r.consoleCritical.length} | ${r.pass ? 'PASS' : `FAIL: ${r.failReason}`} |`,
    ),
    '',
  ].join('\n');
  writeFileSync(join(OUT, 'report.md'), md);
  console.log(`\nReport: ${join(OUT, 'report.md')}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
