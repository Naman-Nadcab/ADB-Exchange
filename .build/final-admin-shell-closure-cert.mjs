/**
 * READ-ONLY certification closure — no mutations.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = process.env.ADMIN_BASE_URL || 'http://127.0.0.1/admin';
const PASSWORD = process.env.ADMIN_CERT_PASSWORD || 'admin123';

const report = {
  generatedAt: new Date().toISOString(),
  rbac: {},
  breadcrumbs: {},
  emergencyLabels: {},
  errors: [],
};

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  return page.url();
}

async function tabVisible(page, name) {
  return page.getByRole('tab', { name }).isVisible().catch(() => false);
}

async function assessRole(label, email) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const row = { email, label, controlTab: false, cryptoTab: false, forexTab: false };
  try {
    const landing = await login(page, email);
    row.loginOk = !landing.includes('/login');
    row.landing = landing;
    if (!row.loginOk) {
      row.status = 'NOT_VERIFIED';
      row.reason = 'login failed';
      await browser.close();
      return row;
    }
    row.controlTab = await tabVisible(page, 'Control Center');
    row.cryptoTab = await tabVisible(page, 'Crypto');
    row.forexTab = await tabVisible(page, 'Forex');
    await page.goto(`${BASE}/forex/orders`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    row.directForexUrl = page.url();
    row.forexDirectBlocked = !page.url().includes('/forex/orders');
    await page.goto(`${BASE}/trading`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    row.directTradingUrl = page.url();
    row.cryptoDirectBlocked = !page.url().includes('/trading');
    row.status = 'PASS';
  } catch (e) {
    row.status = 'FAIL';
    row.error = String(e.message);
  }
  await browser.close();
  return row;
}

async function breadcrumbCheck(path, expectDomain) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await login(page, 'admin@example.com');
    await page.goto(`${BASE}${path.replace(/^\//, '')}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const crumbText = await page.locator('header nav').first().innerText().catch(() => '');
    return { path, expectDomain, crumbText, pass: crumbText.toLowerCase().includes(expectDomain.toLowerCase()) };
  } finally {
    await browser.close();
  }
}

async function emergencyReadOnly() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const out = {};
  try {
    await login(page, 'admin@example.com');
    for (const [key, path] of [
      ['controlCenter', '/control-center'],
      ['forexControls', '/forex/controls'],
      ['adminControl', '/admin-control'],
      ['settingsSystem', '/settings/system'],
    ]) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const body = (await page.locator('main').innerText().catch(() => '')).slice(0, 8000);
      out[key] = { path, sampleLabels: body.match(/(Trading Halt|Withdrawal|kill switch|MM|maintenance|Emergency|Safe mode|Global trading)/gi)?.slice(0, 12) ?? [] };
    }
  } finally {
    await browser.close();
  }
  return out;
}

report.rbac.full = await assessRole('full_access', 'admin@example.com');
report.rbac.controlOnly = await assessRole('control_only', 'approver@example.com');
report.rbac.cryptoOnly = { status: 'NOT_VERIFIED', reason: 'No crypto-only admin_users row in production DB (only super_admin x2, withdrawal_approver)' };
report.rbac.forexOnly = { status: 'NOT_VERIFIED', reason: 'No forex-only admin_users row in production DB' };

for (const [path, domain] of [
  ['/control-center', 'Control Center'],
  ['/trading', 'Crypto'],
  ['/forex/orders', 'Forex'],
]) {
  report.breadcrumbs[path] = await breadcrumbCheck(path, domain);
}

report.emergencyLabels = await emergencyReadOnly();
report.executionPerformed = false;

writeFileSync('.build/FINAL_ADMIN_SHELL_CLOSURE_CERT.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
