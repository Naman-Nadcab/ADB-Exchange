import { expect, type Page } from '@playwright/test';

const CHART_ASSERTION_PATTERN = /data must be asc ordered by time/i;

export function installChartAssertionMonitor(page: Page): () => string[] {
  const violations: string[] = [];
  page.on('console', (msg) => {
    const txt = msg.text();
    if (CHART_ASSERTION_PATTERN.test(txt)) violations.push(`console:${txt}`);
  });
  page.on('pageerror', (err) => {
    const txt = String(err?.message ?? err);
    if (CHART_ASSERTION_PATTERN.test(txt)) violations.push(`pageerror:${txt}`);
  });
  return () => violations;
}

export async function expectChartHealthy(page: Page): Promise<void> {
  await page.waitForSelector('#chart-mount', { state: 'visible', timeout: 30_000 });
  await expect(page.locator('#chart-mount canvas').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Chart unavailable\./i)).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/Chart UI hit an unexpected error/i)).toHaveCount(0, { timeout: 30_000 });
}
