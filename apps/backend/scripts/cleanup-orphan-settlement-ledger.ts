/**
 * Remove settlement_ledger_entries whose settlement_event_id no longer exists.
 * Safe maintenance for historical engine-reset / partial-delete corruption.
 *
 * Run: cd apps/backend && npx tsx scripts/cleanup-orphan-settlement-ledger.ts
 */
import 'dotenv/config';
import { db } from '../src/lib/database.js';
import { logger } from '../src/lib/logger.js';

async function main(): Promise<void> {
  await db.transaction(async (client) => {
    await client.query('LOCK TABLE settlement_ledger_entries IN ACCESS EXCLUSIVE MODE');
    await client.query(
      'ALTER TABLE settlement_ledger_entries DISABLE TRIGGER trg_settlement_ledger_immutable_no_delete'
    );
    await client.query(
      'ALTER TABLE settlement_ledger_entries DISABLE TRIGGER trg_settlement_ledger_immutable_no_update'
    );
    try {
      const before = await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c
         FROM settlement_ledger_entries sle
         LEFT JOIN settlement_events se ON se.id = sle.settlement_event_id
         WHERE se.id IS NULL`
      );
      const deleted = await client.query<{ count: string }>(
        `WITH del AS (
           DELETE FROM settlement_ledger_entries sle
           WHERE NOT EXISTS (
             SELECT 1 FROM settlement_events se WHERE se.id = sle.settlement_event_id
           )
           RETURNING 1
         )
         SELECT COUNT(*)::text AS count FROM del`
      );
      console.log(
        JSON.stringify({
          orphan_before: Number(before.rows[0]?.c ?? '0'),
          deleted: Number(deleted.rows[0]?.count ?? '0'),
        })
      );
    } finally {
      await client.query(
        'ALTER TABLE settlement_ledger_entries ENABLE TRIGGER trg_settlement_ledger_immutable_no_update'
      );
      await client.query(
        'ALTER TABLE settlement_ledger_entries ENABLE TRIGGER trg_settlement_ledger_immutable_no_delete'
      );
    }
  });
  await db.close();
}

main().catch(async (err) => {
  logger.error('cleanup-orphan-settlement-ledger failed', {
    error: err instanceof Error ? err.message : String(err),
  });
  try {
    await db.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
