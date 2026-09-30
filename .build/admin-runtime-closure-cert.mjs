#!/usr/bin/env node
/**
 * Extended admin runtime closure cert — read-only navigation, no emergency actions.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.ADMIN_BASE_URL || 'http://127.0.0.1/admin';
const EMAIL = process.env.ADMIN_CERT_EMAIL || 'admin@example.com';
const PASSWORD = process.env.ADMIN_CERT_PASSWORD || 'admin123';
const outDir = join(process.cwd(), '.build/admin-cert-screenshots');
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

const results = [];
function record(name, ok, detail = '') {
  results.push({ check: name, status: ok ? 'PASS' : 'FAIL', detail });
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForSelector('#email', { timeout: 30_000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/control-center/, { timeout: 30_000 });
}

const browser = await chromium.launch({ headless: true });

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  try {
    await login(page);
    record(`responsive_${vp.name}_login`, true);
    await page.screenshot({ path: join(outDir, `cc-${vp.name}.png`) });
    const tabs = page.getByRole('navigation', { name: 'Admin workspace' });
    await tabs.waitFor({ timeout: 10_000 });
    record(`responsive_${vp.name}_tabs`, true);
  } catch (e) {
    record(`responsive_${vp.name}`, false, String(e?.message || e));
  }
  if (consoleErrors.length) {
    record(`responsive_${vp.name}_console`, false, consoleErrors.slice(0, 3).join(' | '));
  } else {
    record(`responsive_${vp.name}_console`, true);
  }
  await page.close();
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await login(page);

  await page.goto(`${BASE}/control-center`, { waitUntil: 'networkidle' });
  const ccText = await page.locator('main').innerText();
  record('ia_control_center_platform', /Platform/i.test(ccText));
  record('ia_control_center_crypto_ops', /Crypto operations/i.test(ccText));
  record('ia_no_forex_kill_in_cc', !/Forex kill switch/i.test(ccText));
  record('ia_forex_pointer', /forex\/controls|Forex controls/i.test(ccText));

  await page.goto(`${BASE}/admin-control`, { waitUntil: 'networkidle' });
  const acText = await page.locator('main').innerText();
  record('ia_admin_control_label', /Advanced Exchange Controls/i.test(acText));

  await page.goto(`${BASE}/forex/controls`, { waitUntil: 'networkidle' });
  const fxText = await page.locator('main').innerText();
  record('ia_forex_kill_label', /Forex kill switch/i.test(fxText));

  for (const route of ['/dashboard', '/trading', '/audit', '/forex/orders']) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    record(`route_${route.replace(/\//g, '_')}`, page.url().includes(route.split('/').pop() || route));
  }

  await page.screenshot({ path: join(outDir, 'forex-controls.png'), fullPage: true });
  await page.screenshot({ path: join(outDir, 'admin-control.png'), fullPage: true });
} catch (e) {
  record('extended_flow', false, String(e?.message || e));
}
await browser.close();

const payload = {
  generatedAt: new Date().toISOString(),
  adminBase: BASE,
  results,
  overall: results.every((r) => r.status === 'PASS') ? 'PASS' : 'PARTIAL',
};
writeFileSync(join(process.cwd(), '.build/ADMIN_RUNTIME_CLOSURE_CERTIFICATION.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));
process.exit(payload.overall === 'PASS' ? 0 : 1);
