import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { setCustomerLocale, type CustomerLocale } from './helpers/i18n-locale';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');
const OUT = path.join(process.cwd(), '.build', 'i18n-markets-browser-audit');

const ZH_FORBIDDEN = [
  'Trending Dashboard',
  'Top Movers',
  'Market Heatmap',
  'Advanced Filters',
  'Institutional Market Table',
  'Recently Added Assets',
  'Market Intelligence',
  'Most Active Trading Pairs',
];

const ZH_EXPECT = ['趋势仪表盘', '涨跌幅榜', '市场热力图', '高级筛选', '机构级市场表格'];

for (const locale of ['en', 'zh-CN', 'id-ID'] as CustomerLocale[]) {
  test(`markets page rendered audit · ${locale}`, async ({ browser }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setCustomerLocale(context, locale, BASE);
    const page = await context.newPage();
    await page.goto(`${BASE}/markets`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    await page.screenshot({ path: path.join(OUT, `markets_${locale}.png`), fullPage: false });
    fs.writeFileSync(path.join(OUT, `markets_${locale}.json`), JSON.stringify({ locale, sample: text.slice(0, 5000) }, null, 2));
    await context.close();
    if (locale === 'zh-CN') {
      const hits = ZH_FORBIDDEN.filter((p) => text.includes(p));
      expect(hits, hits.join(', ')).toEqual([]);
      expect(ZH_EXPECT.filter((p) => text.includes(p)).length).toBeGreaterThanOrEqual(4);
    }
  });
}
