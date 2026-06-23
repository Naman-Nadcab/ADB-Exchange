import { test, expect } from '@playwright/test';
import { expectChartHealthy, installChartAssertionMonitor } from './helpers/chart-health';

test.describe('Spot chart stress', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/trade/spot', { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await expectChartHealthy(page);
  });

  test('rapid timeframe switching keeps chart stable', async ({ page }) => {
    test.setTimeout(90_000);
    const getViolations = installChartAssertionMonitor(page);

    const intervals = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M', '1m', '5m', '15m'] as const;
    for (const label of intervals) {
      await page.getByRole('button', { name: label, exact: true }).first().click();
      await page.waitForTimeout(180);
      await expectChartHealthy(page);
    }

    expect(getViolations()).toEqual([]);
  });

  test('rapid symbol switching does not crash chart', async ({ page }) => {
    test.setTimeout(90_000);
    const getViolations = installChartAssertionMonitor(page);

    const marketTable = page.locator('table').filter({
      has: page.getByRole('columnheader', { name: 'Pair' }),
    }).first();
    const marketRows = marketTable.locator('tbody tr');

    await expect.poll(async () => marketRows.count(), { timeout: 30_000 }).toBeGreaterThan(3);

    const clicks = [1, 2, 3, 1, 2, 0];
    for (const idx of clicks) {
      await marketRows.nth(idx).click();
      await page.waitForTimeout(220);
      await expectChartHealthy(page);
    }

    expect(getViolations()).toEqual([]);
  });

  test('offline-online websocket reconnect keeps chart alive', async ({ page, context }) => {
    test.setTimeout(90_000);
    const getViolations = installChartAssertionMonitor(page);

    await context.setOffline(true);
    await page.waitForTimeout(2_000);
    await context.setOffline(false);
    await page.waitForTimeout(4_000);

    const retry = page.getByRole('button', { name: /^Retry$/ }).first();
    if (await retry.isVisible().catch(() => false)) {
      await retry.click();
    }
    await expectChartHealthy(page);
    expect(getViolations()).toEqual([]);
  });

  test('chart-depth rapid toggles recover correctly', async ({ page }) => {
    test.setTimeout(90_000);
    const getViolations = installChartAssertionMonitor(page);

    for (let i = 0; i < 8; i += 1) {
      await page.getByRole('button', { name: 'Depth', exact: true }).first().click();
      await page.waitForTimeout(120);
      await page.getByRole('button', { name: 'Chart', exact: true }).first().click();
      await page.waitForTimeout(180);
      await expectChartHealthy(page);
    }

    expect(getViolations()).toEqual([]);
  });
});
