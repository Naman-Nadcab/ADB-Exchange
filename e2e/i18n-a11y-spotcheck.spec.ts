import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1').replace(/\/$/, '');

test.describe('I18n accessibility spot-check (partial)', () => {
  test('login page — axe critical violations', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });

  test('P2P marketplace — axe critical violations', async ({ page }) => {
    await page.goto(`${BASE}/p2p`, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await page.locator('body').waitFor({ state: 'visible' });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
  });
});
