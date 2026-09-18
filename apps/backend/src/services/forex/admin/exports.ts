/**
 * Admin Forex CSV exports (read-only, capped row count).
 */
import {
  listForexAdminJournalEvents,
  parseForexAdminJournalQuery,
} from './journal-audit.js';
import { buildForexAdminCrmClientsSnapshotForAdmin } from './crm-clients.js';
import {
  buildForexAdminFinanceAccountsSnapshot,
  listForexAdminFinanceReconciliation,
} from './crm-finance.js';
import {
  listForexAdminExecutions,
  listForexAdminOrders,
  parseForexAdminListQuery,
} from './lists.js';

const EXPORT_MAX = 5000;

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\n');
}

export async function exportForexAdminOrdersCsv(raw: Parameters<typeof parseForexAdminListQuery>[0]): Promise<string> {
  const q = parseForexAdminListQuery({ ...raw, page: '1', limit: String(EXPORT_MAX) });
  const { rows } = await listForexAdminOrders(q);
  return rowsToCsv(
    [
      'order_id',
      'account_id',
      'symbol',
      'side',
      'order_type',
      'status',
      'requested_volume',
      'filled_volume',
      'remaining_volume',
      'execution_mode',
      'created_at',
    ],
    rows as unknown as Record<string, unknown>[],
  );
}

export async function exportForexAdminExecutionsCsv(raw: Parameters<typeof parseForexAdminListQuery>[0]): Promise<string> {
  const q = parseForexAdminListQuery({ ...raw, page: '1', limit: String(EXPORT_MAX) });
  const { rows } = await listForexAdminExecutions(q);
  return rowsToCsv(
    [
      'execution_id',
      'account_id',
      'symbol',
      'side',
      'status',
      'volume',
      'filled_volume',
      'execution_price',
      'selected_provider',
      'created_at',
    ],
    rows as unknown as Record<string, unknown>[],
  );
}

export async function exportForexAdminCrmClientsCsv(
  adminRole: string,
  raw: {
    q?: string;
    account_status?: string;
    user_status?: string;
    has_open_positions?: string;
    kyc_status?: string;
    risk_level?: string;
  },
): Promise<string> {
  const data = await buildForexAdminCrmClientsSnapshotForAdmin(adminRole, { ...raw, page: '1', limit: String(EXPORT_MAX) });
  return rowsToCsv(
    [
      'account_id',
      'user_id',
      'email',
      'phone',
      'user_status',
      'account_status',
      'kyc_status',
      'kyc_level',
      'risk_level',
      'risk_flags',
      'customer_cash_balance',
      'open_positions',
      'account_created_at',
    ],
    data.rows.map((r) => ({
      ...r,
      risk_flags: r.risk_flags.join('; '),
      kyc_level: r.kyc_level ?? '',
    })) as unknown as Record<string, unknown>[],
  );
}

export async function exportForexAdminFinanceAccountsCsv(raw: {
  q?: string;
  account_status?: string;
}): Promise<string> {
  const data = await buildForexAdminFinanceAccountsSnapshot({ ...raw, page: '1', limit: String(EXPORT_MAX) });
  return rowsToCsv(
    [
      'account_id',
      'user_id',
      'email',
      'currency',
      'account_status',
      'customer_cash_balance',
      'ledger_transaction_count',
      'last_reconciliation_ok',
      'last_reconciliation_at',
    ],
    data.rows.map((r) => ({
      ...r,
      last_reconciliation_ok: r.last_reconciliation_ok == null ? '' : r.last_reconciliation_ok ? 'true' : 'false',
      last_reconciliation_at: r.last_reconciliation_at ?? '',
    })) as unknown as Record<string, unknown>[],
  );
}

export async function exportForexAdminFinanceReconciliationCsv(raw: {
  account_id?: string;
  kind?: string;
  ok?: string;
}): Promise<string> {
  const data = await listForexAdminFinanceReconciliation({ ...raw, page: '1', limit: String(EXPORT_MAX) });
  return rowsToCsv(
    ['event_id', 'account_id', 'kind', 'ok', 'reason', 'detail', 'created_at'],
    data.rows.map((r) => ({
      ...r,
      ok: r.ok ? 'true' : 'false',
    })) as unknown as Record<string, unknown>[],
  );
}

export async function exportForexAdminJournalCsv(raw: Parameters<typeof parseForexAdminJournalQuery>[0]): Promise<string> {
  const q = parseForexAdminJournalQuery({ ...raw, page: '1', limit: String(EXPORT_MAX) });
  const { rows } = await listForexAdminJournalEvents(q);
  return rowsToCsv(
    ['id', 'account_id', 'severity', 'category', 'event_type', 'message', 'order_id', 'position_id', 'created_at'],
    rows as unknown as Record<string, unknown>[],
  );
}
