import { test, expect } from '@playwright/test';

/** Smoke: manual LocaleLanguageSelector persists explicit cookies on HTTP (production NODE_ENV). */
test.describe('Manual locale selector', () => {
  test('en → zh-CN → id-ID → en with refresh and navigation', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/markets', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', /en/i);

    await page.getByRole('button', { name: 'Select display language' }).click();
    await page.getByRole('option', { name: '简体中文' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN', { timeout: 15_000 });

    let cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'mlive_locale')?.value).toBe('zh-CN');
    expect(cookies.find((c) => c.name === 'mlive_locale_explicit')?.value).toBe('1');
    expect(cookies.find((c) => c.name === 'mlive_locale')?.secure).toBe(false);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');

    await page.getByRole('button', { name: '选择显示语言' }).click();
    await page.getByRole('option', { name: 'Bahasa Indonesia' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'id', { timeout: 15_000 });

    await page.goto('/markets', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');

    await page.getByRole('button', { name: 'Pilih bahasa tampilan' }).click();
    await page.getByRole('option', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 15_000 });

    cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'mlive_locale')?.value).toBe('en');
    expect(cookies.find((c) => c.name === 'mlive_locale_explicit')?.value).toBe('1');
  });
});
