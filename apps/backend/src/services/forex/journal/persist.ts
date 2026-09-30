import { db } from '../../../lib/database.js';
import { forexIsoTimestamp, forexStr } from '../durability/tx.js';
import { sanitizeJournalMetadata, type ForexJournalEvent, type ForexJournalSeverity } from './models.js';

export async function persistForexJournalEvent(event: ForexJournalEvent): Promise<void> {
  await db.query(
    `INSERT INTO forex_journal_events (
       id, account_id, severity, category, event_type, order_id, position_id, reference_id, message, metadata, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO NOTHING`,
    [
      event.id,
      event.accountId,
      event.severity,
      event.category,
      event.eventType,
      event.orderId,
      event.positionId,
      event.referenceId,
      event.message,
      JSON.stringify(event.metadata),
      forexIsoTimestamp(event.createdAt, new Date().toISOString()),
    ]
  );
}

function rowSeverity(value: unknown): ForexJournalSeverity {
  return value === 'warn' || value === 'error' ? value : 'info';
}

function rowCategory(value: unknown): ForexJournalEvent['category'] {
  return value === 'protection' || value === 'position' || value === 'system' ? value : 'order';
}

function rowToEvent(row: Record<string, unknown>): ForexJournalEvent {
  return {
    id: forexStr(row.id),
    accountId: forexStr(row.account_id),
    severity: rowSeverity(row.severity),
    category: rowCategory(row.category),
    eventType: forexStr(row.event_type),
    orderId: row.order_id == null ? null : forexStr(row.order_id),
    positionId: row.position_id == null ? null : forexStr(row.position_id),
    referenceId: row.reference_id == null ? null : forexStr(row.reference_id),
    message: forexStr(row.message),
    metadata: sanitizeJournalMetadata(row.metadata),
    createdAt: forexStr(row.created_at),
  };
}

/** Recent tail across all accounts, used only to warm the in-memory journal. */
export async function loadRecentForexJournalEvents(limit: number): Promise<ForexJournalEvent[]> {
  const res = await db.query(
    `SELECT * FROM forex_journal_events ORDER BY created_at DESC LIMIT $1`,
    [Math.max(1, Math.min(limit, 5000))]
  );
  return (res.rows as Record<string, unknown>[]).map(rowToEvent);
}

export async function loadForexJournalEventsForAccount(accountId: string, limit: number): Promise<ForexJournalEvent[]> {
  const res = await db.query(
    `SELECT * FROM forex_journal_events WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [accountId, Math.max(1, Math.min(limit, 1000))]
  );
  return (res.rows as Record<string, unknown>[]).map(rowToEvent);
}
