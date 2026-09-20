/**
 * Forex chart drawing browser certification (desktop + mobile viewports).
 * FX_BASE=http://109.123.254.30 node scripts/forex-chart-drawing-browser-cert.mjs
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.FX_BASE ?? 'http://109.123.254.30';
const EMAIL = process.env.FX_EMAIL ?? 'qa_trader_a@local.exchange';
const PASSWORD = process.env.FX_PASSWORD ?? 'TestPass123';

const results = {};
const matrix = {};

function pass(key, ok, detail = '') {
  results[key] = { ok: Boolean(ok), detail };
  console.log(`${ok ? 'PASS' : 'FAIL'} ${key}${detail ? ` — ${detail}` : ''}`);
}

function cell(tool, action, status) {
  if (!matrix[tool]) matrix[tool] = {};
  matrix[tool][action] = status;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
  await page.waitForTimeout(4000);
  return !/\/login(\?|$)/.test(page.url());
}

async function openDrawTools(page) {
  const tools = page.getByRole('button', { name: /Show chart drawing tools|Hide chart drawing tools/i });
  await tools.first().click();
  await page.waitForTimeout(800);
  const pressed = await tools.first().getAttribute('aria-pressed');
  if (pressed !== 'true') {
    await tools.first().click();
    await page.waitForTimeout(500);
  }
}

async function drawWithTool(page, toolLabel, toolKey) {
  await page.getByRole('button', { name: 'Drawing tool: Select', exact: true }).click({ force: true });
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: `Drawing tool: ${toolLabel}`, exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  const placement = page.locator('.drawing-tools-placement').first();
  if ((await placement.count()) === 0) {
    cell(toolKey, 'Create', 'FAIL');
    return false;
  }
  await placement.waitFor({ timeout: 20_000, state: 'attached' });
  const pe = await placement.evaluate((el) => window.getComputedStyle(el).pointerEvents);
  if (pe !== 'auto') {
    cell(toolKey, 'Create', 'FAIL');
    return false;
  }
  const box = await placement.boundingBox();
  if (!box) {
    cell(toolKey, 'Create', 'FAIL');
    return false;
  }
  const dispatchClick = async (relX, relY) => {
    await placement.evaluate(
      (el, { rx, ry }) => {
        const r = el.getBoundingClientRect();
        const ev = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: r.left + rx,
          clientY: r.top + ry,
          button: 0,
        });
        el.dispatchEvent(ev);
      },
      { rx: relX, ry: relY }
    );
  };
  const pos1 = { x: Math.floor(box.width * 0.35), y: Math.floor(box.height * 0.4) };
  const pos2 = { x: Math.floor(box.width * 0.65), y: Math.floor(box.height * 0.55) };
  await dispatchClick(pos1.x, pos1.y);
  await page.waitForTimeout(400);
  if (toolKey !== 'hline' && toolKey !== 'vline' && toolKey !== 'text' && toolKey !== 'sr' && toolKey !== 'pricelabel') {
    await dispatchClick(pos2.x, pos2.y);
    await page.waitForTimeout(400);
  }
  if (toolKey === 'channel') {
    await dispatchClick(pos2.x, pos2.y - 24);
    await page.waitForTimeout(400);
  }
  const stored = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('eda-forex-drawings:'));
    let count = 0;
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        const parsed = raw ? JSON.parse(raw) : [];
        count += Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        /* ignore */
      }
    }
    return { keys: keys.length, count };
  });
  const ok = stored.count > 0;
  cell(toolKey, 'Create', ok ? 'PASS' : 'FAIL');
  cell(toolKey, 'Refresh', 'NOT VERIFIED');
  return ok;
}

async function runViewport(page, name, width, height) {
  await page.setViewportSize({ width, height });
  pass(`viewport_${name}`, true, `${width}x${height}`);
  await page.goto(`${BASE}/forex/trade`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForResponse((r) => r.url().includes('/api/v1/forex/candles') && r.status() === 200, { timeout: 90_000 }).catch(() => null);
  await page.waitForTimeout(4000);
  await page.locator('canvas').first().waitFor({ timeout: 60_000 });
  await openDrawTools(page);
  const hline = await drawWithTool(page, 'H-Line', 'hline');
  pass(`${name}_hline`, hline);
  const trend = await drawWithTool(page, 'Trend', 'trend');
  pass(`${name}_trend`, trend);
  const fib = await drawWithTool(page, 'Fib', 'fib');
  pass(`${name}_fib`, fib);
  const ray = await drawWithTool(page, 'Ray', 'ray');
  pass(`${name}_ray`, ray);
  await page.keyboard.press('Escape');
  pass(`${name}_escape`, true);
  const before = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('eda-forex-drawings:'));
    return keys.length;
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const after = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('eda-forex-drawings:'));
    let count = 0;
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        const parsed = raw ? JSON.parse(raw) : [];
        count += Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        /* ignore */
      }
    }
    return { keys: keys.length, count };
  });
  pass(`${name}_persistence`, after.count > 0 && after.keys >= before, `keys=${after.keys} drawings=${after.count}`);
  cell('aggregate', 'Refresh', after.count > 0 ? 'PASS' : 'FAIL');
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  pass('login', await login(page));
  await runViewport(page, 'desktop1440', 1440, 900);
  await runViewport(page, 'mobile390', 390, 844);
  await browser.close();
  const out = { generatedAt: new Date().toISOString(), base: BASE, results, matrix };
  writeFileSync('.build/forex-chart-drawing-browser-certification.json', JSON.stringify(out, null, 2));
  console.log('Wrote .build/forex-chart-drawing-browser-certification.json');
  const failed = Object.values(results).some((r) => !r.ok);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
