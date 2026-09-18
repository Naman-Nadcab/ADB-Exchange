import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Forex Admin certification — API smoke against cert backend (:4100).
 * UI project: FOREX_ADMIN_UI_E2E=1, admin built with NEXT_PUBLIC_API_BASE_URL=:4100,
 * served on :3010 (or FOREX_ADMIN_UI_BASE); cert backend CORS must include that origin.
 */
const adminUi = (process.env.FOREX_ADMIN_UI_BASE ?? process.env.ADMIN_BASE_URL ?? 'http://127.0.0.1/admin').replace(
  /\/$/,
  '',
);

export default defineConfig({
  testDir: './e2e/forex-admin',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 25_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/reports/forex-admin-playwright.json' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'forex-admin-api',
      testMatch: /api-smoke\.spec\.ts/,
    },
    {
      name: 'forex-admin-functional',
      testMatch: /functional-.*\.spec\.ts/,
    },
    {
      name: 'forex-admin-ui',
      testMatch: /ui-navigation\.spec\.ts|live-phase-a-ui\.spec\.ts/,
      use: { baseURL: adminUi },
    },
  ],
});
