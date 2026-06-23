import { test, expect } from '@playwright/test';
import { expectChartHealthy, installChartAssertionMonitor } from './helpers/chart-health';

test.describe('Spot chart manual validation flow', () => {
  test('uses shared chart readiness criteria', async ({ page }) => {
    const getViolations = installChartAssertionMonitor(page);

    await page.goto('/trade/spot', { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await expectChartHealthy(page);

    const marketTable = page.locator('table').filter({
      has: page.getByRole('columnheader', { name: 'Pair' }),
    }).first();
    const marketRows = marketTable.locator('tbody tr');
    await expect.poll(async () => marketRows.count(), { timeout: 30_000 }).toBeGreaterThan(3);

    const clickMarket = async (matcher: RegExp, label: string) => {
      const row = marketRows.filter({ hasText: matcher }).first();
      await expect(row, `${label}: market row not found`).toBeVisible({ timeout: 30_000 });
      await row.click();
      await page.waitForTimeout(250);
      await expectChartHealthy(page);
    };

    await clickMarket(/BTC/i, 'BTC baseline');
    await clickMarket(/ETH/i, 'BTC to ETH');
    await clickMarket(/SOL/i, 'ETH to SOL');

    const clickTimeframe = async (name: string) => {
      await page.getByRole('button', { name, exact: true }).first().click();
      await page.waitForTimeout(220);
      await expectChartHealthy(page);
    };

    await clickTimeframe('1m');
    await clickTimeframe('5m');
    await clickTimeframe('1H');

    expect(getViolations()).toEqual([]);
  });
});
