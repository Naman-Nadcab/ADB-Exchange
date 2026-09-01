import { ForexLedgerError } from './models.js';
import type { ForexLedgerAccount, ForexLedgerTxType } from './accounts.js';
import type { ForexAccountingEvent, ForexLedgerEntry, ForexLedgerTransaction } from './models.js';
import { fxDecimal } from '../decimal-fx.js';
import { fxq, type ForexQueryable } from '../durability/tx.js';

export async function persistLedgerTransaction(
  tx: ForexLedgerTransaction,
  client?: ForexQueryable
): Promise<'inserted' | 'replay'> {
  const q = fxq(client);
  const header = await q.query(
    `INSERT INTO forex_ledger_transactions (
       transaction_id, idempotency_key, fingerprint, type, account_id, currency, status, metadata, source, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SIMULATED',$9)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING transaction_id`,
    [
      tx.transactionId,
      tx.idempotencyKey,
      tx.fingerprint,
      tx.type,
      tx.accountId,
      tx.currency,
      tx.status,
      JSON.stringify(tx.metadata ?? {}),
      tx.createdAt,
    ]
  );
  if ((header.rowCount ?? 0) === 0) {
    const existing = await q.query(
      `SELECT transaction_id, fingerprint FROM forex_ledger_transactions WHERE idempotency_key = $1`,
      [tx.idempotencyKey]
    );
    const row = existing.rows[0] as { transaction_id?: string; fingerprint?: string } | undefined;
    if (!row) throw new ForexLedgerError('LEDGER_PERSIST_FAILED', 'idempotency conflict without existing row');
    if (String(row.fingerprint) !== tx.fingerprint) {
      throw new ForexLedgerError('IDEMPOTENCY_CONFLICT', 'idempotency key reused with different content', 409);
    }
    return 'replay';
  }

  for (const e of tx.entries) {
    await q.query(
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

  const sums = await q.query(
    `SELECT COALESCE(SUM(debit), 0) AS debits, COALESCE(SUM(credit), 0) AS credits
     FROM forex_ledger_entries WHERE transaction_id = $1`,
    [tx.transactionId]
  );
  const debits = fxDecimal(String((sums.rows[0] as { debits?: unknown }).debits ?? 0));
  const credits = fxDecimal(String((sums.rows[0] as { credits?: unknown }).credits ?? 0));
  if (!debits.eq(credits)) {
    throw new ForexLedgerError('LEDGER_UNBALANCED', `persisted debits ${debits.toFixed()} != credits ${credits.toFixed()}`);
  }
  return 'inserted';
}

export async function persistAccountingEvent(event: ForexAccountingEvent, client?: ForexQueryable): Promise<void> {
  const q = fxq(client);
  await q.query(
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

function rowToTx(row: Record<string, unknown>, entries: ForexLedgerEntry[]): ForexLedgerTransaction {
  return {
    transactionId: String(row.transaction_id),
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
  };
}

function mapEntries(rows: Record<string, unknown>[]): ForexLedgerEntry[] {
  return rows.map((e) => ({
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
}

export async function loadLedgerByAccount(accountId: string, client?: ForexQueryable): Promise<ForexLedgerTransaction[]> {
  const q = fxq(client);
  const txRes = await q.query(`SELECT * FROM forex_ledger_transactions WHERE account_id = $1 ORDER BY created_at`, [
    accountId,
  ]);
  const out: ForexLedgerTransaction[] = [];
  for (const row of txRes.rows as Record<string, unknown>[]) {
    const id = String(row.transaction_id);
    const eRes = await q.query(`SELECT * FROM forex_ledger_entries WHERE transaction_id = $1 ORDER BY created_at`, [id]);
    out.push(rowToTx(row, mapEntries(eRes.rows as Record<string, unknown>[])));
  }
  return out;
}

export async function loadLedgerByKey(key: string, client?: ForexQueryable): Promise<ForexLedgerTransaction | null> {
  const q = fxq(client);
  const txRes = await q.query(`SELECT * FROM forex_ledger_transactions WHERE idempotency_key = $1`, [key]);
  const row = txRes.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const eRes = await q.query(`SELECT * FROM forex_ledger_entries WHERE transaction_id = $1 ORDER BY created_at`, [
    String(row.transaction_id),
  ]);
  return rowToTx(row, mapEntries(eRes.rows as Record<string, unknown>[]));
}

export async function loadAllLedgerTransactions(client?: ForexQueryable): Promise<ForexLedgerTransaction[]> {
  const q = fxq(client);
  const txRes = await q.query(`SELECT * FROM forex_ledger_transactions ORDER BY created_at`);
  const out: ForexLedgerTransaction[] = [];
  for (const row of txRes.rows as Record<string, unknown>[]) {
    const id = String(row.transaction_id);
    const eRes = await q.query(`SELECT * FROM forex_ledger_entries WHERE transaction_id = $1 ORDER BY created_at`, [id]);
    out.push(rowToTx(row, mapEntries(eRes.rows as Record<string, unknown>[])));
  }
  return out;
}

export async function customerCashBalanceFromDb(accountId: string, client?: ForexQueryable): Promise<string> {
  const q = fxq(client);
  const res = await q.query(
    `SELECT COALESCE(SUM(credit - debit), 0) AS bal
     FROM forex_ledger_entries
     WHERE ledger_account = 'CUSTOMER_CASH' AND account_id = $1`,
    [accountId]
  );
  return String((res.rows[0] as { bal?: unknown } | undefined)?.bal ?? '0');
}
