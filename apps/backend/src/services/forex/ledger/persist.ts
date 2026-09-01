import { db } from '../../../lib/database.js';
import type { ForexLedgerAccount, ForexLedgerTxType } from './accounts.js';
import type { ForexAccountingEvent, ForexLedgerEntry, ForexLedgerTransaction } from './models.js';

export async function persistLedgerTransaction(tx: ForexLedgerTransaction): Promise<void> {
  await db.query(
    `INSERT INTO forex_ledger_transactions (
       transaction_id, idempotency_key, fingerprint, type, account_id, currency, status, metadata, source
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SIMULATED')
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      tx.transactionId,
      tx.idempotencyKey,
      tx.fingerprint,
      tx.type,
      tx.accountId,
      tx.currency,
      tx.status,
      JSON.stringify(tx.metadata ?? {}),
    ]
  );
  for (const e of tx.entries) {
    await db.query(
      `INSERT INTO forex_ledger_entries (
         entry_id, transaction_id, ledger_account, account_id, debit, credit, currency,
         reference_type, reference_id, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (entry_id) DO NOTHING`,
      [
        e.entryId,
        e.transactionId,
        e.ledgerAccount,
        e.accountId,
        e.debit,
        e.credit,
        e.currency,
        e.referenceType,
        e.referenceId,
        e.timestamp,
      ]
    );
  }
}

export async function persistAccountingEvent(event: ForexAccountingEvent): Promise<void> {
  await db.query(
    `INSERT INTO forex_accounting_events (
       event_id, account_id, event_type, transaction_id, position_id, fill_id, reason, metadata, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (event_id) DO NOTHING`,
    [
      event.eventId,
      event.accountId,
      event.eventType,
      event.transactionId ?? null,
      event.positionId ?? null,
      event.fillId ?? null,
      event.reason ?? null,
      JSON.stringify(event.metadata ?? {}),
      event.timestamp,
    ]
  );
}

export async function loadLedgerByAccount(accountId: string): Promise<ForexLedgerTransaction[]> {
  const txRes = await db.query(
    `SELECT * FROM forex_ledger_transactions WHERE account_id = $1 ORDER BY created_at`,
    [accountId]
  );
  const out: ForexLedgerTransaction[] = [];
  for (const row of txRes.rows as Record<string, unknown>[]) {
    const id = String(row.transaction_id);
    const eRes = await db.query(`SELECT * FROM forex_ledger_entries WHERE transaction_id = $1 ORDER BY created_at`, [id]);
    const entries: ForexLedgerEntry[] = (eRes.rows as Record<string, unknown>[]).map((e) => ({
      entryId: String(e.entry_id),
      transactionId: String(e.transaction_id),
      ledgerAccount: e.ledger_account as ForexLedgerAccount,
      accountId: e.account_id == null ? null : String(e.account_id),
      debit: String(e.debit),
      credit: String(e.credit),
      currency: String(e.currency),
      timestamp: String(e.created_at),
      referenceType: e.reference_type == null ? null : String(e.reference_type),
      referenceId: e.reference_id == null ? null : String(e.reference_id),
    }));
    out.push({
      transactionId: id,
      idempotencyKey: String(row.idempotency_key),
      fingerprint: String(row.fingerprint),
      type: row.type as ForexLedgerTxType,
      accountId: String(row.account_id),
      currency: String(row.currency),
      status: row.status === 'REJECTED' ? 'REJECTED' : 'POSTED',
      entries,
      createdAt: String(row.created_at),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      source: 'SIMULATED',
    });
  }
  return out;
}
