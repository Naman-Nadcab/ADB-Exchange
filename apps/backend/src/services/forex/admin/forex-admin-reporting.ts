/**
 * Forex admin reporting — aggregates from authoritative tables only.
 */
import { db } from '../../../lib/database.js';

export type ForexAdminReportCategory =
  | 'executive'
  | 'trading'
  | 'clients'
  | 'risk'
  | 'finance'
  | 'partners'
  | 'compliance'
  | 'audit';

export type ForexAdminReportMetric = {
  id: string;
  label: string;
  category: ForexAdminReportCategory;
  value: string | number | null;
  source: string;
  status: 'VERIFIED' | 'NOT_AVAILABLE';
  freshness: string;
};

export type ForexAdminReportingSnapshot = {
  time_range: { label: string; from: string; to: string };
  metrics: ForexAdminReportMetric[];
  note: string;
};

export async function buildForexAdminReportingSnapshot(range?: { from?: string; to?: string }): Promise<ForexAdminReportingSnapshot> {
  const to = range?.to ? new Date(range.to) : new Date();
  const from = range?.from ? new Date(range.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('INVALID_DATE_RANGE');
  }
  const metrics: ForexAdminReportMetric[] = [];

  async function countQuery(
    label: string,
    id: string,
    category: ForexAdminReportCategory,
    sql: string,
    source: string,
    params?: unknown[],
  ): Promise<void> {
    try {
      const r = await db.query<{ n: string }>(sql, params);
      metrics.push({
        id,
        label,
        category,
        value: Number.parseInt(r.rows[0]?.n ?? '0', 10) || 0,
        source,
        status: 'VERIFIED',
        freshness: to.toISOString(),
      });
    } catch {
      metrics.push({ id, label, category, value: null, source, status: 'NOT_AVAILABLE', freshness: to.toISOString() });
    }
  }

  await countQuery('Open Forex orders (non-terminal)', 'orders_open', 'trading', `SELECT COUNT(*)::text AS n FROM forex_orders WHERE status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')`, 'forex_orders');
  await countQuery('Open positions', 'positions_open', 'risk', `SELECT COUNT(*)::text AS n FROM forex_positions WHERE status = 'OPEN'`, 'forex_positions');
  await countQuery(
    'Orders (range)',
    'orders_range',
    'trading',
    `SELECT COUNT(*)::text AS n FROM forex_orders WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
    'forex_orders',
    [from.toISOString(), to.toISOString()],
  );
  await countQuery(
    'Executions (range)',
    'executions_range',
    'trading',
    `SELECT COUNT(*)::text AS n FROM forex_executions WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
    'forex_executions',
    [from.toISOString(), to.toISOString()],
  );
  await countQuery('Forex accounts', 'accounts_total', 'clients', `SELECT COUNT(*)::text AS n FROM forex_accounts`, 'forex_accounts');
  await countQuery('CRM open leads', 'leads_open', 'clients', `SELECT COUNT(*)::text AS n FROM forex_crm_leads WHERE status = 'open'`, 'forex_crm_leads');
  await countQuery('Pending approvals (Forex actions)', 'approvals_pending', 'finance', `SELECT COUNT(*)::text AS n FROM admin_approval_requests WHERE status = 'pending' AND action_type LIKE 'forex_%'`, 'admin_approval_requests');
  await countQuery('Finance requests (pending)', 'finance_pending', 'finance', `SELECT COUNT(*)::text AS n FROM forex_finance_requests WHERE status IN ('PENDING','PROCESSING')`, 'forex_finance_requests');
  await countQuery('Open compliance cases', 'compliance_open', 'compliance', `SELECT COUNT(*)::text AS n FROM forex_compliance_cases WHERE status = 'OPEN'`, 'forex_compliance_cases');
  await countQuery(
    'Dealer actions (range)',
    'dealer_actions_range',
    'audit',
    `SELECT COUNT(*)::text AS n FROM forex_dealing_actions WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
    'forex_dealing_actions',
    [from.toISOString(), to.toISOString()],
  );
  await countQuery('Partner accruals', 'partner_accruals', 'partners', `SELECT COUNT(*)::text AS n FROM forex_partner_commission_accruals`, 'forex_partner_commission_accruals');
  await countQuery('Partner payouts (pending)', 'partner_payouts_pending', 'partners', `SELECT COUNT(*)::text AS n FROM forex_partner_payout_requests WHERE status = 'PENDING'`, 'forex_partner_payout_requests');
  await countQuery('Automation runs (range)', 'automation_runs_range', 'audit', `SELECT COUNT(*)::text AS n FROM forex_automation_runs WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`, 'forex_automation_runs', [from.toISOString(), to.toISOString()]);

  metrics.push({
    id: 'executive_activity_index',
    label: 'Platform activity index (orders + executions in range)',
    category: 'executive',
    value:
      (metrics.find((m) => m.id === 'orders_range')?.value as number | null) != null &&
      (metrics.find((m) => m.id === 'executions_range')?.value as number | null) != null
        ? Number(metrics.find((m) => m.id === 'orders_range')?.value ?? 0) +
          Number(metrics.find((m) => m.id === 'executions_range')?.value ?? 0)
        : null,
    source: 'derived',
    status:
      metrics.find((m) => m.id === 'orders_range')?.status === 'VERIFIED' &&
      metrics.find((m) => m.id === 'executions_range')?.status === 'VERIFIED'
        ? 'VERIFIED'
        : 'NOT_AVAILABLE',
    freshness: to.toISOString(),
  });

  return {
    time_range: { label: 'Selected reporting window', from: from.toISOString(), to: to.toISOString() },
    metrics,
    note: 'Values are DB aggregates · revenue/spread P&L requires dedicated finance reporting · NOT AVAILABLE if table missing',
  };
}
