import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { setCustomerLocale, type CustomerLocale } from './helpers/i18n-locale';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');
const OUT = path.join(process.cwd(), '.build', 'i18n-home-browser-audit');

const ZH_FORBIDDEN = [
  'Built for precision',
  'Global Markets',
  'One platform. Two markets.',
  'Complete account visibility',
  'Market intelligence',
  'Ready for the markets?',
  'Explore Markets',
  'Create Account',
];

const ZH_EXPECT = ['全球市场', '一个平台', '精准', '账户', '市场情报'];

for (const locale of ['en', 'zh-CN', 'id-ID'] as CustomerLocale[]) {
  test(`home page rendered audit · ${locale}`, async ({ browser }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setCustomerLocale(context, locale, BASE);
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    await page.screenshot({ path: path.join(OUT, `home_${locale}.png`), fullPage: false });
    fs.writeFileSync(path.join(OUT, `home_${locale}.json`), JSON.stringify({ locale, sample: text.slice(0, 5000) }, null, 2));
    await context.close();
    if (locale === 'zh-CN') {
      const hits = ZH_FORBIDDEN.filter((p) => text.includes(p));
      expect(hits, hits.join(', ')).toEqual([]);
      expect(text).toMatch(/探索行情|创建账户|全球市场/);
    }
    if (locale === 'id-ID') {
      expect(text).toMatch(/Jelajahi Pasar|Buat Akun|Pasar Global/i);
    }
  });
}
