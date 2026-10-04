import { defineConfig } from '@playwright/test';

/**
 * Real-browser certification for STEP 26. Requires the isolated stack to be running
 * (backend + frontend + admin panel). No webServer, no route stubs; see browser.spec.ts.
 */
export default defineConfig({
  testDir: __dirname,
  testMatch: 'browser.spec.ts',
  outputDir: process.env.FULL_SYSTEM_PW_OUTPUT ?? '/tmp/s26/pw-out',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: Number(process.env.FULL_SYSTEM_PW_WORKERS ?? 2),
  reporter: [['list']],
  timeout: 240_000,
  expect: { timeout: 10_000 },
  use: {
    headless: true,
    trace: 'off',
    screenshot: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
