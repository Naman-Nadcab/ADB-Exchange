/**
 * Dead-route sweep: every customer GET route registered in the backend is called with a real
 * session. Any 5xx is a defect. 4xx for routes that need params/feature flags is reported, not hidden.
 * Usage: npx tsx e2e/full-system/route-sweep.ts
 */
import { readFileSync } from 'node:fs';
import { api, db, walletLogin } from './lib.js';

const ROUTE_FILE = process.env.FULL_SYSTEM_ROUTE_DUMP ?? '/tmp/s26/routes.txt';

const PREFIX: Record<string, string> = {
  'auth.fastify.ts': '/api/v1/auth',
  'auth-wallet-management.fastify.ts': '/api/v1/auth',
  'auth-wallet-recovery.fastify.ts': '/api/v1/auth',
  'trading.fastify.ts': '/api/v1/trading',
  'p2p.fastify.ts': '/api/v1/p2p',
  'fiat.fastify.ts': '/api/v1/fiat',
  'user.fastify.ts': '/api/v1/user',
  'wallet.fastify.ts': '/api/v1/wallet',
  'convert.fastify.ts': '/api/v1/convert',
  'kyc.ts': '/api/v1/kyc',
  'spot.fastify.ts': '/api/v1/spot',
  'push.fastify.ts': '/api/v1/push',
  'support-user.fastify.ts': '/api/v1/support',
  'public.fastify.ts': '/api/v1/public',
  'forex.fastify.ts': '/api/v1/forex',
  'forex-orders.fastify.ts': '/api/v1/forex',
  'forex-positions.fastify.ts': '/api/v1/forex',
  'forex-customer-accounts.fastify.ts': '/api/v1/forex',
  'forex-customer-live-funding.fastify.ts': '/api/v1/forex',
  'forex-accounting.fastify.ts': '/api/v1/forex',
  'forex-advanced.fastify.ts': '/api/v1/forex',
  'forex-risk.fastify.ts': '/api/v1/forex',
  'forex-protection.fastify.ts': '/api/v1/forex',
  'forex-liquidation.fastify.ts': '/api/v1/forex',
  'forex-info.fastify.ts': '/api/v1/forex',
  'observability.fastify.ts': '/api/v1/observability',
};

const SAMPLE: Record<string, string> = {
  ':symbol': 'BTC_USDT',
  ':chainId': 'ethereum',
  ':id': '00000000-0000-0000-0000-000000000001',
  ':orderId': '00000000-0000-0000-0000-000000000001',
  ':positionId': '00000000-0000-0000-0000-000000000001',
  ':accountId': '00000000-0000-0000-0000-000000000001',
  ':txHash': '0xdeadbeef',
  ':adId': '00000000-0000-0000-0000-000000000001',
  ':disputeId': '00000000-0000-0000-0000-000000000001',
  ':advertiserId': '00000000-0000-0000-0000-000000000001',
  ':clientExecId': 'step26',
  ':applicationId': '00000000-0000-0000-0000-000000000001',
  ':alertId': '00000000-0000-0000-0000-000000000001',
  ':requestId': '00000000-0000-0000-0000-000000000001',
};

async function main(): Promise<void> {
  const lines = readFileSync(ROUTE_FILE, 'utf8').split('\n').filter(Boolean);
  const session = await walletLogin();
  const results: { route: string; status: number; body: string }[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const [file, method, path] = line.split(' ');
    if (!file || !method || !path || method !== 'GET') continue;
    const prefix = PREFIX[file];
    if (!prefix) continue;
    if (path === '/ws' || path.endsWith('/ws')) continue;
    let full = `${prefix}${path}`;
    for (const [k, v] of Object.entries(SAMPLE)) full = full.replace(k, v);
    if (seen.has(full)) continue;
    seen.add(full);
    const res = await api('GET', full, { token: session.accessToken });
    results.push({ route: full, status: res.status, body: res.text.slice(0, 160) });
  }
  // 503 with an explicit "provider not configured / reference unavailable" code is an honest external
  // dependency signal, not a defect. Anything else >= 500 is a defect.
  const EXTERNAL_503 = ['PUSH_DISABLED', 'REFERENCE_UNAVAILABLE', 'PROVIDER_NOT_CONFIGURED'];
  const external = results.filter((r) => r.status === 503 && EXTERNAL_503.some((c) => r.body.includes(c)));
  const fives = results.filter((r) => r.status >= 500 && !external.includes(r));
  const fours = results.filter((r) => r.status >= 400 && r.status < 500);
  console.log(
    `routes=${results.length} 2xx/3xx=${results.length - fives.length - fours.length - external.length} 4xx=${fours.length} external-503=${external.length} 5xx=${fives.length}`,
  );
  for (const r of fours) console.log(`  4xx ${r.status} ${r.route} ${r.body}`);
  for (const r of external) console.log(`  EXTERNAL ${r.status} ${r.route} ${r.body}`);
  for (const r of fives) console.log(`  5xx ${r.status} ${r.route} ${r.body}`);
  await db.end();
  if (fives.length > 0) {
    console.log('ROUTE_SWEEP_FAIL');
    process.exit(1);
  }
  console.log('ROUTE_SWEEP_PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
