import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1/admin';
const viewports = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/control-center/, { timeout: 30000 });
}

const browser = await chromium.launch({ headless: true });
const out = [];

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  try {
    await login(page);
    const domainBar = await page.getByRole('navigation', { name: 'Admin workspace' }).isVisible();
    await page.getByRole('tab', { name: 'Crypto' }).click();
    await page.waitForURL(/dashboard/);
    await page.getByRole('tab', { name: 'Forex' }).click();
    await page.waitForURL(/\/forex/);
    out.push({ viewport: vp.name, status: 'PASS', domainBar, consoleErrors: errors });
  } catch (e) {
    out.push({ viewport: vp.name, status: 'FAIL', error: String(e.message), consoleErrors: errors });
  }
  await page.close();
}

const page = await browser.newPage();
await login(page);
try {
  const logo = page.locator('aside a[href="/control-center"]').first();
  await logo.click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  out.push({ test: 'logo_control_center', status: page.url().includes('/control-center') ? 'PASS' : 'FAIL', url: page.url() });
} catch (e) {
  out.push({ test: 'logo_control_center', status: 'FAIL', error: String(e.message) });
}
await page.goto(`${BASE}/audit`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
out.push({ test: 'shared_audit_route', status: page.url().includes('/audit') ? 'PASS' : 'FAIL' });
await browser.close();
console.log(JSON.stringify(out, null, 2));
