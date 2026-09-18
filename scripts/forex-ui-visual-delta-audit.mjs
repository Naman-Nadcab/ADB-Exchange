#!/usr/bin/env node
/**
 * True visual workspace audit — DOM metrics + screenshots (not string-marker cert).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.build/forex-ui-visual-delta-audit.json');
const SHOT_DIR = path.join(ROOT, '.build/forex-ui-screenshots');
const LIVE_ADMIN = process.env.FOREX_LIVE_ADMIN ?? 'http://109.123.254.30/admin';
const LIVE_API = process.env.FOREX_LIVE_API_BASE ?? 'http://127.0.0.1:4000/api/v1/admin';

const WORKSPACE_EXPECT = {
  '/forex/dealing': { minButtons: 8, pattern: 'dealer' },
  '/forex/market-data': { minTables: 1, minInputs: 1, pattern: 'market-data' },
  '/forex/crm/pipeline': { minButtons: 2, pattern: 'kanban' },
  '/forex/crm/leads': { minTables: 1, minInputs: 2, pattern: 'crm' },
  '/forex/risk-control': { minTables: 1, pattern: 'risk' },
  '/forex/reporting': { minTables: 1, pattern: 'reporting' },
  '/forex/automation': { minButtons: 2, pattern: 'automation' },
};

function parseRoutes() {
  const nav = fs.readFileSync(path.join(ROOT, 'apps/admin-panel/src/lib/admin/forex-admin-nav.ts'), 'utf8');
  const start = nav.indexOf('export const FOREX_ADMIN_ROUTES');
  const re = /\{\s*id:\s*'([^']+)',\s*label:[\s\S]*?href:\s*'([^']+)'/g;
  const routes = [];
  let m;
  while ((m = re.exec(nav.slice(start)))) routes.push({ id: m[1], href: m[2], label: m[0].match(/label:\s*'([^']+)'/)?.[1] });
  return routes;
}

async function login() {
  const res = await fetch(`${LIVE_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.FOREX_LIVE_ADMIN_EMAIL ?? 'admin@example.com',
      password: process.env.FOREX_LIVE_ADMIN_PASSWORD ?? 'admin123',
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('login failed');
  return json.data;
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await login(); // verify API creds early
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const adminEmail = process.env.FOREX_LIVE_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.FOREX_LIVE_ADMIN_PASSWORD ?? 'admin123';

  async function goto(url) {
    for (let i = 0; i < 3; i += 1) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('main', { timeout: 20000 }).catch(() => null);
        await page.waitForSelector('table, .forex-workspace-header, [data-stage]', { timeout: 15000 }).catch(() => null);
        await page.waitForTimeout(800);
        return page.url();
      } catch {
        await page.waitForTimeout(600);
      }
    }
    return page.url();
  }

  async function uiLogin() {
    await page.goto(`${LIVE_ADMIN}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('input[type="email"]').first().fill(adminEmail);
    await page.locator('input[type="password"]').first().fill(adminPassword);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/admin\//, { timeout: 45000 }).catch(() => null);
    await page.waitForSelector('aside', { timeout: 30000 }).catch(() => null);
  }

  async function seedSession() {
    if (page.url().includes('/login') || !(await page.locator('aside').count())) {
      await uiLogin();
    }
    await goto(`${LIVE_ADMIN}/forex`);
    await page.waitForTimeout(600);
  }

  await seedSession();

  const routes = parseRoutes();
  const results = [];

  for (let i = 0; i < routes.length; i += 1) {
    const r = routes[i];
    const url = `${LIVE_ADMIN}${r.href}`;
    if (i > 0 && i % 6 === 0) await seedSession();
    let finalUrl = await goto(url);
    if (finalUrl.includes('/login') || finalUrl.includes('session_expired')) {
      await seedSession();
      finalUrl = await goto(url);
    }

    let metrics = {
      aside_count: 0,
      main_width: 0,
      table_count: 0,
      input_count: 0,
      button_count: 0,
      has_kanban_hint: false,
      has_workspace_header: false,
      has_object_object: false,
      word_count: 0,
      h1: null,
    };
    try {
      metrics = await page.evaluate(() => {
        const main = document.querySelector('main');
        const text = document.body?.innerText ?? '';
        return {
          aside_count: document.querySelectorAll('aside').length,
          main_width: main?.getBoundingClientRect().width ?? 0,
          table_count: document.querySelectorAll('table').length,
          input_count: document.querySelectorAll('input, select, textarea').length,
          button_count: document.querySelectorAll('button').length,
          has_kanban_hint:
            document.querySelectorAll('[data-stage], .forex-kanban-column').length >= 2 ||
            (/pipeline|stage board/i.test(text) && document.querySelectorAll('[data-stage]').length > 0),
          has_workspace_header:
            text.includes('Forex operations workspace') || !!document.querySelector('.forex-workspace-header'),
          has_object_object: text.includes('[object Object]'),
          word_count: text.split(/\s+/).filter(Boolean).length,
          h1: document.querySelector('h1')?.textContent?.trim() ?? null,
        };
      });
    } catch {
      await page.waitForTimeout(500);
    }

    const expect = WORKSPACE_EXPECT[r.href];
    const defects = [];
    if (finalUrl.includes('/login') || finalUrl.includes('session_expired')) defects.push('auth_blocked');
    if (metrics.has_object_object) defects.push('object_object');
    if (metrics.word_count < 80) defects.push('thin_content');
    if (metrics.table_count === 0 && metrics.button_count < 2) defects.push('no_operational_surface');
    if (expect) {
      if (expect.minTables && metrics.table_count < expect.minTables) defects.push('missing_table');
      if (expect.minButtons && metrics.button_count < expect.minButtons) defects.push('missing_actions');
      if (expect.minInputs && metrics.input_count < expect.minInputs) defects.push('missing_filters');
    }

    const slug = r.href.replace(/^\//, '').replace(/\//g, '_') || 'forex';
    const shotPath = path.join(SHOT_DIR, `${slug}.png`);
    await page.screenshot({ path: shotPath, fullPage: false }).catch(() => null);

    const purposeBuilt =
      defects.length === 0 &&
      metrics.word_count >= 80 &&
      (metrics.has_workspace_header ||
        metrics.table_count >= 1 ||
        metrics.has_kanban_hint ||
        metrics.input_count >= 2 ||
        metrics.button_count >= 8);

    results.push({
      route: r.href,
      label: r.label,
      url: finalUrl,
      metrics,
      screenshot: path.relative(ROOT, shotPath),
      defects,
      visually_purpose_built: purposeBuilt,
      ui_depth: purposeBuilt ? 'TIER1_CANDIDATE' : metrics.table_count >= 1 ? 'OPERATIONAL' : 'BASIC',
    });
  }

  await browser.close();

  const tier1 = results.filter((r) => r.ui_depth === 'TIER1_CANDIDATE').length;
  const out = {
    generatedAt: new Date().toISOString(),
    method: 'DOM metrics + screenshots + workspace heuristics (NOT marker-string cert)',
    tier1_candidate_routes: tier1,
    total_routes: results.length,
    routes: results,
    domain_screenshots: {
      command: results.find((r) => r.route === '/forex/command')?.screenshot,
      crm: results.find((r) => r.route === '/forex/crm/leads')?.screenshot,
      dealing: results.find((r) => r.route === '/forex/dealing')?.screenshot,
      risk: results.find((r) => r.route === '/forex/risk-control')?.screenshot,
      markets: results.find((r) => r.route === '/forex/market-data')?.screenshot,
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('Wrote', OUT, 'TIER1 candidates', tier1, '/', results.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
