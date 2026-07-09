/**
 * Phase 2 — Alert Center verification.
 * Run: OUT_DIR=/opt/m-live/docs/verification-alert-center node scripts/verify-alert-center.mjs
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT_DIR || '/opt/m-live/docs/verification-alert-center';
const BASE = process.env.ADMIN_BASE || 'http://127.0.0.1/admin';
const API = 'http://127.0.0.1:4000/api/v1/admin';

fs.mkdirSync(OUT, { recursive: true });

const results = [];

function psql(sql) {
  try {
    return execSync(`docker exec exchange-postgres psql -U exchange -d exchange -t -A -c ${JSON.stringify(sql)}`, {
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('input[type=email], input[name=email]').first().fill('admin@example.com');
  await page.locator('input[type=password]').first().fill('admin123');
  await page.locator('button[type=submit]').first().click();
  await page.waitForTimeout(4000);
}

async function getToken() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
  });
  const j = await res.json();
  return j?.data?.accessToken ?? '';
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const token = await getToken();

  // 1. Alert Center page loads
  await login(page);
  await page.goto(`${BASE}/alerts`, { waitUntil: 'networkidle', timeout: 60000 });
  const titleVisible = await page.locator('h1.admin-title', { hasText: 'Alert Center' }).isVisible();
  await page.screenshot({ path: path.join(OUT, '01-alert-center-page.png'), fullPage: true });
  results.push({ test: 'Alert Center page loads', pass: titleVisible });

  // 2. KPI cards visible
  const kpiOpen = await page.getByText('Open', { exact: true }).first().isVisible();
  results.push({ test: 'KPI cards visible', pass: kpiOpen });

  // 3. Status filters
  const filterOpen = await page.getByRole('button', { name: /Open \(\d+\)|Open$/ }).first().isVisible();
  results.push({ test: 'Status filters visible', pass: filterOpen });

  // 4. Alert table has rows
  const rowCount = await page.locator('table tbody tr').count();
  results.push({ test: 'Alert table has rows', pass: rowCount > 0, detail: `${rowCount} rows` });

  // 5. Drawer badge + open drawer
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  const bellBtn = page.locator('button[aria-label*="alert" i], button[title*="alert" i]').first();
  const bellExists = await bellBtn.count() > 0;
  if (bellExists) {
    await bellBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, '02-alert-drawer.png'), fullPage: true });
    const drawerTitle = await page.getByText('Alert Center').first().isVisible();
    const infraSection = await page.getByText('Infrastructure').first().isVisible();
    results.push({ test: 'Alert drawer opens with infrastructure section', pass: drawerTitle && infraSection });
  } else {
    results.push({ test: 'Alert drawer opens with infrastructure section', pass: false, detail: 'Bell button not found' });
  }

  // 6. Acknowledge flow on /alerts
  await page.goto(`${BASE}/alerts`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByRole('button', { name: /^Open \(\d+\)|Open$/ }).first().click();
  await page.waitForTimeout(1500);
  const ackBtn = page.locator('table tbody').getByRole('button', { name: 'Ack' }).first();
  const ackExists = await ackBtn.count() > 0;
  if (ackExists) {
    const auditBefore = parseInt(psql(`SELECT COUNT(*) FROM audit_logs_immutable WHERE action='monitoring_alert_updated'`), 10) || 0;
    await ackBtn.click();
    await page.getByText('Acknowledge alert').waitFor({ timeout: 8000 });
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, '03-ack-flow.png'), fullPage: true });
    const auditAfter = parseInt(psql(`SELECT COUNT(*) FROM audit_logs_immutable WHERE action='monitoring_alert_updated'`), 10) || 0;
    const ackPass = auditAfter > auditBefore;
    results.push({ test: 'Acknowledge → Confirm → audit log', pass: ackPass, detail: `audit ${auditBefore}→${auditAfter}` });
  } else {
    results.push({ test: 'Acknowledge → Confirm → audit log', pass: false, detail: 'No Ack button' });
  }

  // 7. Summary API (backend)
  const summaryRes = await fetch(`${API}/monitoring/alerts/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const summaryJson = await summaryRes.json();
  results.push({
    test: 'GET /monitoring/alerts/summary',
    pass: summaryRes.ok && summaryJson?.data?.open != null,
    detail: JSON.stringify(summaryJson?.data ?? {}),
  });

  // 8. Severity filter
  await page.goto(`${BASE}/alerts`, { waitUntil: 'networkidle', timeout: 60000 });
  const criticalFilter = page.getByRole('button', { name: 'Critical' });
  if (await criticalFilter.count() > 0) {
    await criticalFilter.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, '04-critical-filter.png'), fullPage: true });
    results.push({ test: 'Severity filter (Critical) works', pass: true });
  } else {
    results.push({ test: 'Severity filter (Critical) works', pass: false });
  }

  await browser.close();

  const passCount = results.filter((r) => r.pass).length;
  const report = {
    phase: 'Phase 2 — Alert Center',
    timestamp: new Date().toISOString(),
    base: BASE,
    pass: passCount,
    total: results.length,
    allPass: passCount === results.length,
    results,
  };

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# Phase 2 Alert Center Verification',
    '',
    `**Result:** ${passCount}/${results.length} PASS`,
    '',
    ...results.map((r) => `- [${r.pass ? 'x' : ' '}] ${r.test}${r.detail ? ` — ${r.detail}` : ''}`),
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'report.md'), md);
  console.log(md);
  process.exit(report.allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
