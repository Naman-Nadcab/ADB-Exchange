import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { setCustomerLocale, type CustomerLocale } from '../e2e/helpers/i18n-locale';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');
const OUT = path.join(process.cwd(), '.build', 'i18n-spot-browser-audit');

/** User-facing English that should NOT appear when zh-CN is active (excluding universal notation). */
const ZH_CN_FORBIDDEN = [
  'Order Book',
  'Order Entry',
  'Market Trades',
  'Top Movers',
  'Recent Trades',
  'Favorites',
  'Last Price',
  '24h Change',
  'Open Orders',
  'Order History',
  'Trade History',
  'Waiting for market activity',
  'Sign in to trade',
  'Good-Til-Cancelled',
];

const ZH_CN_EXPECT = ['订单簿', '最新成交', '涨跌幅榜', '自选', '最新价', '买入', '卖出'];

const ID_FORBIDDEN = [
  'Order Book',
  'Favorites',
  'Market Trades',
  'Sign in to trade',
  'Order Entry',
  'Waiting for market activity',
];
const ID_EXPECT = ['Buku Order', 'Favorit', 'Grafik', 'Kedalaman', 'Entri Order'];

async function visibleText(page: import('@playwright/test').Page): Promise<string> {
  await page.locator('#spot-order-entry-panel, .exchange-ui').first().waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return page.evaluate(() => {
    const walk = (el: Element): string => {
      let s = '';
      for (const n of el.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) s += n.textContent ?? '';
        else if (n instanceof HTMLElement) {
          const style = window.getComputedStyle(n);
          if (style.visibility !== 'hidden' && style.display !== 'none') s += walk(n);
        }
      }
      return s;
    };
    return walk(document.body).replace(/\s+/g, ' ').trim();
  });
}

function findForbidden(text: string, patterns: string[]): string[] {
  return patterns.filter((p) => text.includes(p));
}

for (const locale of ['en', 'zh-CN', 'id-ID'] as CustomerLocale[]) {
  test(`spot rendered text audit · ${locale}`, async ({ browser }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await setCustomerLocale(context, locale, BASE);
    const page = await context.newPage();
    await page.goto(`${BASE}/trade/spot?symbol=BTC_USDT`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.locator('html')).toHaveAttribute('lang', locale === 'id-ID' ? 'id' : locale);

    const text = await visibleText(page);
    const shot = path.join(OUT, `spot_${locale}_1440x900.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const report: Record<string, unknown> = {
      locale,
      baseUrl: BASE,
      buildNote: process.env.AUDIT_BUILD_LABEL ?? 'unknown',
      screenshot: shot,
      textSample: text.slice(0, 4000),
      forbiddenHits: [] as string[],
      expectHits: [] as string[],
    };

    if (locale === 'zh-CN') {
      report.forbiddenHits = findForbidden(text, ZH_CN_FORBIDDEN);
      report.expectHits = ZH_CN_EXPECT.filter((p) => text.includes(p));
    } else if (locale === 'id-ID') {
      report.forbiddenHits = findForbidden(text, ID_FORBIDDEN);
      report.expectHits = ID_EXPECT.filter((p) => text.includes(p));
    }

    fs.writeFileSync(path.join(OUT, `spot_${locale}.json`), JSON.stringify(report, null, 2));
    await context.close();

    if (locale === 'zh-CN') {
      expect(report.forbiddenHits as string[], `English leaks: ${(report.forbiddenHits as string[]).join(', ')}`).toEqual([]);
      expect((report.expectHits as string[]).length).toBeGreaterThanOrEqual(4);
    }
  });
}
