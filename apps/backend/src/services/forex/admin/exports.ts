/**
 * Admin Forex CSV exports (read-only, capped row count).
 */
import {
  listForexAdminJournalEvents,
  parseForexAdminJournalQuery,
} from './journal-audit.js';
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

export async function exportForexAdminJournalCsv(raw: Parameters<typeof parseForexAdminJournalQuery>[0]): Promise<string> {
  const q = parseForexAdminJournalQuery({ ...raw, page: '1', limit: String(EXPORT_MAX) });
  const { rows } = await listForexAdminJournalEvents(q);
  return rowsToCsv(
    ['id', 'account_id', 'severity', 'category', 'event_type', 'message', 'order_id', 'position_id', 'created_at'],
    rows as unknown as Record<string, unknown>[],
  );
}
