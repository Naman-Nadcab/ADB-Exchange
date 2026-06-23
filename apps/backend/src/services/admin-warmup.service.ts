import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';

/**
 * Admin read-path warmup.
 *
 * Why: on a freshly-booted server the FIRST request that touches a table pays
 * the cold-cache cost (Postgres shared buffers + OS page cache are empty), so
 * a trivial `COUNT(*)` or list query can take 1–4s on the very first hit and
 * ~3–6ms thereafter. That cold hit is what an admin perceives as a slow page
 * the first time they open it after a deploy.
 *
 * This warms the hot admin read tables ONCE, shortly after the HTTP server
 * starts listening, so the cache is primed before anyone navigates. Each query
 * is independent and best-effort — failures are swallowed (a missing table in
 * some environment must never crash or delay startup).
 *
 * Deliberately lightweight: only cheap SELECT/COUNT statements that mirror the
 * queries the busiest admin endpoints run (dashboard, users, withdrawals,
 * trades, monitoring). No writes, no DDL.
 */
const WARMUP_QUERIES: Array<{ label: string; sql: string }> = [
  { label: 'users', sql: `SELECT COUNT(*) FROM users` },
  { label: 'withdrawals_stats', sql: `SELECT COUNT(*) FILTER (WHERE status = 'pending_approval') FROM withdrawals` },
  { label: 'deposits', sql: `SELECT COUNT(*) FROM deposits` },
  { label: 'spot_markets', sql: `SELECT symbol, status FROM spot_markets ORDER BY symbol LIMIT 100` },
  { label: 'spot_orders', sql: `SELECT COUNT(*) FROM spot_orders WHERE status = 'open'` },
  { label: 'settlement_events', sql: `SELECT COUNT(*) FROM settlement_events WHERE status = 'pending'` },
  { label: 'tokens', sql: `SELECT COUNT(*) FROM tokens` },
  { label: 'chains', sql: `SELECT COUNT(*) FROM chains` },
  { label: 'kyc_records', sql: `SELECT COUNT(*) FROM kyc_records WHERE status = 'pending'` },
  { label: 'aml_alerts', sql: `SELECT COUNT(*) FROM aml_alerts WHERE status IN ('open','reviewing')` },
  { label: 'p2p_orders', sql: `SELECT COUNT(*) FROM p2p_orders` },
  { label: 'api_settings', sql: `SELECT COUNT(*) FROM api_settings` },
];

let warmed = false;

/**
 * Run the warmup pass. Idempotent (guards against double-invocation) and
 * deferred so it never blocks the listen path. Runs queries sequentially with
 * a tiny gap so it doesn't itself saturate the pool on boot.
 */
export async function warmAdminReadPaths(delayMs = 1_500): Promise<void> {
  if (warmed) return;
  warmed = true;
  await new Promise((r) => setTimeout(r, delayMs));
  const started = Date.now();
  let ok = 0;
  for (const q of WARMUP_QUERIES) {
    try {
      await db.query(q.sql);
      ok++;
    } catch {
      /* table may not exist in this environment — ignore */
    }
  }
  logger.info('Admin read-path warmup complete', {
    warmed: ok,
    total: WARMUP_QUERIES.length,
    duration_ms: Date.now() - started,
  });
}
