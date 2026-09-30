#!/usr/bin/env node
/** Isolated cert UI tab probe — :3010 admin → :4100 API. Read-only. */
import { chromium } from 'playwright';

const BASE = process.env.CERT_ADMIN_BASE_URL || 'http://127.0.0.1:3010/admin';
const PW = process.env.FOREX_CERT_ADMIN_PASSWORD || 'CertAdmin1!';

const identities = [
  { logical: 'FULL', email: 'cert_maker@cert.local', expectTabs: ['Control Center', 'Crypto', 'Forex'] },
  { logical: 'CRYPTO_ONLY_PROXY', email: 'cert_support@cert.local', expectTabs: ['Control Center', 'Crypto'], forbidTabs: ['Forex'] },
  { logical: 'RISK_MANAGER_NOT_FOREX_ONLY', email: 'cert_risk@cert.local', expectTabs: ['Control Center', 'Crypto', 'Forex'] },
];

const results = [];

const browser = await chromium.launch({ headless: true });
for (const id of identities) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const row = { logical: id.logical, email: id.email, steps: [] };
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForSelector('#email', { timeout: 30_000 });
    await page.fill('#email', id.email);
    await page.fill('#password', PW);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/control-center/, { timeout: 30_000 });
    row.steps.push({ step: 'login', status: 'PASS' });

    const nav = page.getByRole('navigation', { name: 'Admin workspace' });
    await nav.waitFor({ timeout: 10_000 });
    for (const tab of id.expectTabs) {
      const visible = await nav.getByRole('tab', { name: tab }).isVisible();
      row.steps.push({ step: `tab_visible_${tab}`, status: visible ? 'PASS' : 'FAIL' });
    }
    for (const tab of id.forbidTabs ?? []) {
      const visible = await nav.getByRole('tab', { name: tab }).isVisible();
      row.steps.push({ step: `tab_hidden_${tab}`, status: visible ? 'FAIL' : 'PASS' });
    }

    await page.goto(`${BASE}/forex/orders`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const onForex = page.url().includes('/forex/orders');
    const denied = (await page.locator('body').innerText()).toLowerCase().includes('access');
    row.steps.push({
      step: 'direct_forex_orders',
      status: id.forbidTabs?.includes('Forex') ? (denied || !onForex ? 'PASS' : 'FAIL') : onForex ? 'PASS' : 'FAIL',
      url: page.url(),
    });

    await page.goto(`${BASE}/trading`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    row.steps.push({ step: 'direct_trading', status: page.url().includes('/trading') ? 'PASS' : 'FAIL', url: page.url() });
  } catch (e) {
    row.steps.push({ step: 'error', status: 'FAIL', detail: String(e?.message || e) });
  }
  results.push(row);
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ adminBase: BASE, results }, null, 2));
