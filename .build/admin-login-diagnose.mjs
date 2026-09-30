#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const urls = [
  process.env.ADMIN_BASE_URL || 'http://127.0.0.1:3001/admin',
  'http://127.0.0.1:3001/login',
  'http://127.0.0.1/admin/login',
  'http://127.0.0.1/admin',
];

const outDir = join(process.cwd(), '.build/admin-cert-screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = [];

for (const startUrl of urls) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const networkFails = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('requestfailed', (r) => networkFails.push(`${r.url()} ${r.failure()?.errorText}`));

  const entry = { startUrl, status: null, finalUrl: null, title: null, hasEmail: false, visibleTextSample: '', consoleErrors, networkFails };
  try {
    const resp = await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 60_000 });
    entry.status = resp?.status();
    entry.finalUrl = page.url();
    entry.title = await page.title();
    try {
      await page.waitForSelector('#email', { timeout: 15_000 });
      entry.hasEmail = true;
    } catch {
      entry.hasEmail = false;
    }
    entry.visibleTextSample = (await page.locator('body').innerText()).slice(0, 500);
    const slug = startUrl.replace(/[^a-z0-9]+/gi, '_');
    await page.screenshot({ path: join(outDir, `login-${slug}.png`), fullPage: true });
  } catch (e) {
    entry.error = String(e?.message || e);
  }
  report.push(entry);
  await page.close();
}

await browser.close();
writeFileSync(join(process.cwd(), '.build/admin-login-diagnose.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
