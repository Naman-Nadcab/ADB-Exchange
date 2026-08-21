#!/usr/bin/env node
/**
 * Repeated trading invariant validation (default 1000 iterations).
 * Single psql round-trip per iteration — no per-check docker exec spawn.
 */
import { execSync } from 'node:child_process';

const iterations = parseInt(
  process.argv.find((a) => a.startsWith('--iterations='))?.split('=')[1] ?? '1000',
  10
);

const POST_FIX_SINCE = process.env.TRADING_INVARIANT_SINCE || '2026-07-31 11:26:00+00';

function runChecksOnce() {
  const sql = `
SELECT json_build_object(
  'overfill', (SELECT COUNT(*)::int FROM spot_orders WHERE filled_quantity > quantity AND updated_at > '${POST_FIX_SINCE}'::timestamptz),
  'dup_fp', (SELECT COUNT(*)::int FROM (
    SELECT match_engine_id, match_fingerprint FROM settlement_events
    WHERE match_fingerprint IS NOT NULL AND status IN ('pending','processed')
    GROUP BY match_engine_id, match_fingerprint HAVING COUNT(*) > 1
  ) d),
  'neg_bal', (SELECT COUNT(*)::int FROM user_balances WHERE available_balance < 0 OR locked_balance < 0),
  'stuck', (SELECT COUNT(*)::int FROM settlement_events WHERE status='pending' AND created_at < NOW()-INTERVAL '1 hour'),
  'fill_mismatch', (SELECT COUNT(*)::int FROM spot_orders o
    WHERE o.filled_quantity > 0 AND o.updated_at > '${POST_FIX_SINCE}'::timestamptz
      AND ABS(o.filled_quantity::numeric - COALESCE((SELECT SUM(st.quantity::numeric) FROM spot_trades st WHERE st.order_id = o.id), 0)) > 0.00000001)
)::text;
`;
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  const raw = execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange -t -A -c ${JSON.stringify(oneLine)}`,
    { encoding: 'utf8' }
  ).trim();
  return JSON.parse(raw);
}

let failures = 0;
const started = Date.now();

for (let i = 1; i <= iterations; i++) {
  try {
    const r = runChecksOnce();
    const ok =
      r.overfill === 0 &&
      r.dup_fp === 0 &&
      r.neg_bal === 0 &&
      r.stuck === 0 &&
      r.fill_mismatch === 0;
    if (!ok) {
      failures += 1;
      console.error(`FAIL iteration ${i}:`, r);
      if (failures >= 3) break;
    }
  } catch (e) {
    failures += 1;
    console.error(`FAIL iteration ${i}:`, e instanceof Error ? e.message : e);
    if (failures >= 3) break;
  }
  if (i % 100 === 0) console.log(`progress: ${i}/${iterations} (${failures} failures)`);
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
const pass = failures === 0;
console.log(JSON.stringify({ iterations, failures, pass, elapsed_sec: elapsed }, null, 2));
process.exit(pass ? 0 : 1);
