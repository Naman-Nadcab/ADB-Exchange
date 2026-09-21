import { test, expect } from '@playwright/test';
import { setCustomerLocale, type CustomerLocale } from './helpers/i18n-locale';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');

test.describe('Customer locale behavior', () => {
  for (const locale of ['en', 'zh-CN', 'id-ID'] as CustomerLocale[]) {
    test(`explicit cookie sets html lang (${locale})`, async ({ browser }) => {
      const context = await browser.newContext();
      await setCustomerLocale(context, locale, BASE);
      const page = await context.newPage();
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe(locale === 'id-ID' ? 'id' : locale);
      await context.close();
    });
  }

  test('manual locale persists on navigation', async ({ browser }) => {
    const context = await browser.newContext();
    await setCustomerLocale(context, 'zh-CN', BASE);
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${BASE}/p2p`, { waitUntil: 'domcontentloaded' });
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('zh-CN');
    await context.close();
  });
});
