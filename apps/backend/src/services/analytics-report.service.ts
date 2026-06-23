/**
 * Shared analytics report generation — used by both the on-demand export route
 * (GET /admin/analytics/export) and the scheduled-reports delivery worker.
 */
import { db } from '../lib/database.js';

export type ReportType = 'trading' | 'revenue' | 'user-growth' | 'users' | 'aml-alerts';

export const VALID_REPORT_TYPES: ReportType[] = ['trading', 'revenue', 'user-growth', 'users', 'aml-alerts'];

/** Build the row set for a given report type (last 30 days, capped at 5000 rows). */
export async function generateReportRows(report: ReportType): Promise<Record<string, unknown>[]> {
  if (report === 'trading') {
    const r = await db.query<Record<string, string>>(
      `SELECT market, price, quantity, fee, created_at FROM spot_trades WHERE created_at > NOW() - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 5000`
    ).catch(() => ({ rows: [] }));
    return r.rows ?? [];
  }
  if (report === 'revenue') {
    const r = await db.query<Record<string, string>>(
      `SELECT 'trading_fee' AS type, SUM(fee::numeric)::text AS amount FROM spot_trades WHERE created_at > NOW() - INTERVAL '30 days' UNION ALL SELECT 'withdrawal_fee', COALESCE(SUM(withdrawal_fee::numeric), 0)::text FROM withdrawals WHERE created_at > NOW() - INTERVAL '30 days'`
    ).catch(() => ({ rows: [] }));
    return r.rows ?? [];
  }
  if (report === 'user-growth') {
    const r = await db.query<Record<string, string>>(
      `SELECT date_trunc('day', created_at)::date::text AS date, COUNT(*)::text AS new_users FROM users WHERE deleted_at IS NULL AND created_at > NOW() - INTERVAL '30 days' GROUP BY date_trunc('day', created_at) ORDER BY date`
    ).catch(() => ({ rows: [] }));
    return r.rows ?? [];
  }
  if (report === 'users') {
    const r = await db.query<Record<string, string>>(
      `SELECT id::text, email, status::text, email_verified::text, phone::text, created_at::text, last_login_at::text, COALESCE(host(last_login_ip), '')::text AS last_login_ip FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5000`
    ).catch(() => ({ rows: [] }));
    return r.rows ?? [];
  }
  // aml-alerts
  const r = await db.query<Record<string, string>>(
    `SELECT a.id::text, a.user_id::text, u.email AS user_email, a.alert_type::text, a.severity::text, a.status::text, a.created_at::text FROM aml_alerts a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 5000`
  ).catch(() => ({ rows: [] }));
  return r.rows ?? [];
}

/** Serialize rows to the requested artifact format. Returns content + mime + extension. */
export async function rowsToArtifact(
  report: string,
  format: 'csv' | 'json' | 'pdf',
  rows: Record<string, unknown>[]
): Promise<{ content: Buffer | string; mime: string; ext: string }> {
  if (format === 'json') {
    return { content: JSON.stringify({ report, rows }, null, 2), mime: 'application/json', ext: 'json' };
  }
  if (format === 'pdf') {
    const { rowsToPdf } = await import('../lib/report-pdf.js');
    const title = `Analytics — ${report.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Report`;
    return { content: await rowsToPdf(title, rows), mime: 'application/pdf', ext: 'pdf' };
  }
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const csv = [headers.join(',')]
    .concat(rows.map((r) => headers.map((h) => JSON.stringify(String(r[h] ?? ''))).join(',')))
    .join('\n');
  return { content: csv, mime: 'text/csv', ext: 'csv' };
}
