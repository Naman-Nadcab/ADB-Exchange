/**
 * Mission 2 — Session persistence, WebSocket, and optional service restart recovery
 */
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { getSpotWebSocketClass, SpotWsSession } from '../utils/spot-ws-helpers.js';
import { loginUserViaUI } from './helpers/login';
import {
  API_BASE,
  loadCredentials,
  QA_TRADER_A,
  QA_PASSWORD,
  bearerHeaders,
} from './helpers/credentials';

test.describe('Recovery & persistence', () => {
  test('JWT remains valid after browser reload', async ({ page, request }) => {
    const creds = loadCredentials();
    await loginUserViaUI(page, creds.QA_TRADER_A_EMAIL || QA_TRADER_A, creds.QA_PASSWORD || QA_PASSWORD);
    await page.goto('/markets', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/);
    const me = await request.get(`${API_BASE}/api/v1/auth/me`, { headers: bearerHeaders(creds.E2E_JWT) });
    expect(me.ok()).toBeTruthy();
  });

  test('WebSocket connects, authenticates, and subscribes', async () => {
    process.env.E2E_BASE_URL = API_BASE;
    const creds = loadCredentials();
    const Ws = await getSpotWebSocketClass();
    if (!Ws) {
      test.skip();
      return;
    }
    const sess = new SpotWsSession();
    await sess.connect(Ws);
    const authed = await sess.auth(creds.E2E_JWT);
    expect(authed).toBe(true);
    sess.subscribe('user.orders');
    sess.subscribe('BTC_USDT@orderbook');
    await new Promise((r) => setTimeout(r, 2000));
    expect(sess.messages.length).toBeGreaterThan(0);
    sess.close();
  });

  test('health stable after backend ping', async ({ request }) => {
    for (let i = 0; i < 3; i++) {
      const res = await request.get(`${API_BASE}/health`);
      expect(res.ok()).toBeTruthy();
      const j = (await res.json()) as { status?: string };
      expect(j.status).toBe('healthy');
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  test('optional: backend restart + health recovery', async ({ request }) => {
    test.skip(process.env.MISSION2_RESTART_TESTS !== '1', 'Set MISSION2_RESTART_TESTS=1 to run container restarts');

    execSync('docker compose -f docker-compose.production.yml restart backend', {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    const deadline = Date.now() + 120_000;
    let healthy = false;
    while (Date.now() < deadline) {
      try {
        const res = await request.get(`${API_BASE}/health`);
        if (res.ok()) {
          const j = (await res.json()) as { status?: string };
          if (j.status === 'healthy') {
            healthy = true;
            break;
          }
        }
      } catch {
        /* wait */
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    expect(healthy).toBe(true);

    const creds = loadCredentials();
    const me = await request.get(`${API_BASE}/api/v1/auth/me`, { headers: bearerHeaders(creds.E2E_JWT) });
    expect(me.ok()).toBeTruthy();
  });
});
