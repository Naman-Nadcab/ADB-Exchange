import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = process.env.E2E_PORT ?? '3098';
const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  testDir: './apps/frontend/e2e',
  testMatch: 'forex-chart-drawing-certification.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 120_000,
    navigationTimeout: 60_000,
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : {
        command: `npm run dev --workspace=@exchange/frontend -- -p ${E2E_PORT}`,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 240_000,
      },
});
