#!/usr/bin/env node
/**
 * ADMIN SHELL / DOMAIN SEPARATION — lightweight browser certification.
 * Read-only navigation; no destructive mutations.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.ADMIN_BASE_URL || 'http://127.0.0.1:3001/admin';
const EMAIL = process.env.ADMIN_CERT_EMAIL || 'admin@example.com';
const PASSWORD = process.env.ADMIN_CERT_PASSWORD || 'admin123';
const API = process.env.ADMIN_API_BASE || 'http://127.0.0.1:4000';

const outDir = join(process.cwd(), '.build');
mkdirSync(outDir, { recursive: true });

const results = [];

async function step(name, fn) {
  try {
    await fn();
    results.push({ step: name, status: 'PASS' });
  } catch (e) {
    results.push({ step: name, status: 'FAIL', error: String(e?.message || e) });
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await step('login', async () => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/control-center/, { timeout: 30_000 });
});

await step('control_center_landing', async () => {
  const url = page.url();
  if (!url.includes('/control-center')) throw new Error(`Expected control-center, got ${url}`);
  await page.getByRole('navigation', { name: 'Admin workspace' }).waitFor({ timeout: 10_000 });
});

await step('switch_crypto', async () => {
  await page.getByRole('tab', { name: 'Crypto' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
});

await step('switch_forex', async () => {
  await page.getByRole('tab', { name: 'Forex' }).click();
  await page.waitForURL(/\/forex/, { timeout: 15_000 });
});

await step('switch_control', async () => {
  await page.getByRole('tab', { name: 'Control Center' }).click();
  await page.waitForURL(/\/control-center/, { timeout: 15_000 });
});

await step('crypto_route_trading', async () => {
  await page.goto(`${BASE}/trading`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (!page.url().includes('/trading')) throw new Error('trading route failed');
});

await step('forex_route_orders', async () => {
  await page.goto(`${BASE}/forex/orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  if (!page.url().includes('/forex/orders')) throw new Error('forex orders route failed');
});

await browser.close();

const payload = {
  generatedAt: new Date().toISOString(),
  adminBase: BASE,
  apiBase: API,
  results,
  overall: results.every((r) => r.status === 'PASS') ? 'PASS' : 'PARTIAL',
};

writeFileSync(join(outDir, 'ADMIN_SHELL_DOMAIN_SEPARATION_CERTIFICATION.json'), JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));

process.exit(results.every((r) => r.status === 'PASS') ? 0 : 1);
