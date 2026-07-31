/**
 * Lightweight accessibility smoke — key public routes via axe-core.
 * Run: npx tsx e2e/api/a11y-smoke.test.ts
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1';
const ROUTES = ['/', '/markets', '/trade/spot', '/p2p', '/login'];

export async function runA11ySmoke(): Promise<{ passed: number; failed: number; results: string[] }> {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const route of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
      const axe = await new AxeBuilder({ page }).analyze();
      const critical = axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      if (critical.length === 0) {
        results.push(`PASS: a11y ${route} (${axe.violations.length} non-critical)`);
        passed++;
      } else {
        results.push(`FAIL: a11y ${route} critical=${critical.length} (${critical.map((v) => v.id).join(', ')})`);
        failed++;
      }
    } catch (e) {
      results.push(`FAIL: a11y ${route} ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }
  }

  await context.close();
  await browser.close();
  return { passed, failed, results };
}

const isMain = process.argv[1]?.includes('a11y-smoke') ?? false;
if (isMain) {
  runA11ySmoke().then(({ passed, failed, results }) => {
    results.forEach((r) => console.log(r));
    console.log(`Total: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
