#!/usr/bin/env node
/**
 * Validate hedge infrastructure without routing user orders to Binance.
 * - DB tables: hedge_jobs, external_liquidity_providers
 * - Symbol mapping service
 * - Optional testnet credentials + admin /test endpoint
 *
 * Usage:
 *   node scripts/validate-hedge-infrastructure.mjs
 *   BINANCE_TESTNET_API_KEY=... BINANCE_TESTNET_SECRET=... node scripts/validate-hedge-infrastructure.mjs --live
 */
import pg from 'pg';

const BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
const LIVE = process.argv.includes('--live');

function pgSsl(url) {
  try {
    const u = new URL(url.replace(/^postgresql:/i, 'http:'));
    const h = u.hostname.toLowerCase();
    if (['127.0.0.1', 'localhost', 'postgres'].includes(h)) return undefined;
  } catch {
    /* ignore */
  }
  return process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : undefined;
}

async function adminLogin() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';
  const r = await fetch(`${BASE}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(`Admin login failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.data?.accessToken ?? j.data?.token;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: dbUrl, ssl: pgSsl(dbUrl) });
  await client.connect();
  const checks = [];

  try {
    for (const table of ['hedge_jobs', 'external_liquidity_providers', 'external_orders']) {
      const r = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS ok`,
        [table]
      );
      checks.push({ name: `table:${table}`, ok: r.rows[0]?.ok === true });
    }

    const providers = await client.query(
      `SELECT id::text, provider_name, enabled, is_testnet FROM external_liquidity_providers LIMIT 5`
    );
    checks.push({ name: 'providers:count', ok: true, detail: String(providers.rows.length) });

    const token = await adminLogin();
    const hy = await fetch(`${BASE}/api/v1/admin/hybrid/config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const hyJson = await hy.json();
    checks.push({ name: 'api:hybrid/config', ok: hy.ok && hyJson.success !== false });

    if (LIVE) {
      const { spawn } = await import('node:child_process');
      await new Promise((resolve, reject) => {
        const p = spawn('npx', ['tsx', 'scripts/qa-binance-testnet-validate.ts'], {
          cwd: new URL('../apps/backend', import.meta.url).pathname,
          stdio: 'inherit',
          env: process.env,
        });
        p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`testnet validate exit ${code}`))));
      });
      checks.push({ name: 'binance:testnet', ok: true });
    } else {
      checks.push({
        name: 'binance:testnet',
        ok: true,
        detail: 'skipped (pass --live with BINANCE_TESTNET_* env to run qa-binance-testnet-validate.ts)',
      });
    }
  } finally {
    await client.end();
  }

  console.log(JSON.stringify(checks, null, 2));
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
