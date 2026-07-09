import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const authDir = path.join('e2e', '.auth');

export default defineConfig({
  testDir: './e2e/mission2',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  globalSetup: './e2e/mission2/global-setup.ts',
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/reports/mission2-playwright.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.spec\.ts/,
    },
    {
      name: 'mission2-guest',
      testMatch: /01-auth-lifecycle\.spec\.ts/,
    },
    {
      name: 'mission2-trader',
      dependencies: ['setup'],
      testMatch: /0[2-5]-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(authDir, 'trader-a.json'),
      },
    },
    {
      name: 'mission2-admin',
      dependencies: ['setup'],
      testMatch: /06-admin\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mission2-recovery',
      dependencies: ['setup'],
      testMatch: /07-restart-recovery\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
