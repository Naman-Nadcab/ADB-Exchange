/**
 * Integration regression: duplicate match persistence must not double-insert.
 * Run: cd apps/backend && npx tsx src/services/settlement/match-event-persistence.regression.test.ts
 */
import { persistEngineMatchEvents } from './match-event-persistence.service.js';
import { db } from '../../lib/database.js';

const SAMPLE = {
  event_id: 999999001,
  match_engine_id: 'default',
  symbol: 'BTC_USDT',
  price: '1.00',
  qty: '0.00000001',
  taker_order_id: '00000000-0000-4000-8000-000000000001',
  maker_order_id: '00000000-0000-4000-8000-000000000002',
  taker_user_id: '14e57a8f-bbd2-4b48-9b60-6bccede41176',
  maker_user_id: 'a0000000-0000-4000-8000-00000000aa01',
  taker_side: 'buy' as const,
  timestamp: 1999999999001,
};

async function main() {
  await db.query(`DELETE FROM settlement_events WHERE payload->>'timestamp' = $1`, [String(SAMPLE.timestamp)]);

  const r1 = await persistEngineMatchEvents([SAMPLE], 'rust_inline');
  const r2 = await persistEngineMatchEvents(
    [{ ...SAMPLE, event_id: SAMPLE.event_id + 1 }],
    'match_poller'
  );

  const cnt = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM settlement_events
     WHERE payload->>'timestamp' = $1 AND status IN ('pending','processed')`,
    [String(SAMPLE.timestamp)]
  );
  const rows = parseInt(cnt.rows[0]?.n ?? '0', 10);

  await db.query(`DELETE FROM settlement_events WHERE payload->>'timestamp' = $1`, [String(SAMPLE.timestamp)]);

  const pass = r1.inserted === 1 && r2.skipped_duplicate >= 1 && rows === 1;
  console.log(JSON.stringify({ pass, r1, r2, rows }, null, 2));
  await db.end?.();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
