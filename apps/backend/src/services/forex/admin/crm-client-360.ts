/**
 * Forex Client 360 — aggregates read model + CRM operational tables.
 */
import { buildForexAdminCrmClientDetail } from './crm-clients.js';
import { listForexCrmNotes } from './crm-notes.js';
import { db } from '../../../lib/database.js';
import { resolveForexCrmSectionAccess } from './crm-client-scope.js';

export type ForexAdminClient360 = {
  core: NonNullable<Awaited<ReturnType<typeof buildForexAdminCrmClientDetail>>>;
  profile: Record<string, unknown> | null;
  tags: Array<{ tag_id: string; slug: string; label: string }>;
  notes: Awaited<ReturnType<typeof listForexCrmNotes>>;
  tasks: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  trading_summary: null | {
    open_orders: number;
    open_positions: number;
    executions_30d: number;
    source: string;
  };
  finance_summary: null | {
    customer_cash_balance: string;
    pending_finance_requests: number;
    ledger_transactions: number;
    source: string;
  };
  compliance_summary: null | {
    open_cases: number;
    provider_status: 'NOT_CONNECTED';
    source: string;
  };
  partner_summary: null | {
    partner_code: string | null;
    partner_label: string | null;
    source: string;
  };
  related_accounts: Array<{ account_id: string; status: string; currency: string }>;
  recent_notifications: Array<{ notification_id: string; title: string; severity: string; created_at: string }>;
  trading:
    | {
        position_mode: string | null;
        group_code: string | null;
        leverage_override: string | null;
        restricted?: false;
      }
    | {
        position_mode: null;
        group_code: null;
        leverage_override: null;
        restricted: true;
      };
  permissions_hint: {
    compliance_fields: 'forex:compliance:view';
    finance_fields: 'forex:finance:view';
    trading_fields: 'forex:orders:view';
  };
  section_access: {
    compliance: boolean;
    finance: boolean;
    trading: boolean;
  };
};

async function loadProfile(accountId: string) {
  const res = await db.query(`SELECT * FROM forex_crm_client_profiles WHERE account_id = $1 LIMIT 1`, [accountId]);
  return (res.rows[0] as Record<string, unknown> | undefined) ?? null;
}

async function loadTags(accountId: string) {
  const res = await db.query<{ tag_id: string; slug: string; label: string }>(
    `SELECT t.tag_id, t.slug, t.label
     FROM forex_crm_client_tags ct
     JOIN forex_crm_tags t ON t.tag_id = ct.tag_id
     WHERE ct.account_id = $1
     ORDER BY t.label`,
    [accountId]
  );
  return res.rows.map((r) => ({ tag_id: String(r.tag_id), slug: String(r.slug), label: String(r.label) }));
}

async function loadTasks(accountId: string) {
  const res = await db.query(
    `SELECT task_id, title, status, due_at, owner_admin_id, created_at
     FROM forex_crm_tasks
     WHERE account_id = $1 AND status IN ('open','in_progress')
     ORDER BY due_at NULLS LAST, created_at DESC
     LIMIT 25`,
    [accountId]
  );
  return res.rows as Record<string, unknown>[];
}

async function loadActivities(accountId: string) {
  const res = await db.query(
    `SELECT activity_id, kind, summary, metadata, actor_admin_id, created_at
     FROM forex_crm_activities
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT 40`,
    [accountId]
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    ...r,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  }));
}

async function loadTradingMeta(accountId: string) {
  const res = await db.query<{ position_mode: string | null; leverage_override: string | null; group_code: string | null }>(
    `SELECT fa.position_mode, fa.leverage_override, g.code AS group_code
     FROM forex_accounts fa
     LEFT JOIN forex_account_groups g ON g.group_id = fa.group_id
     WHERE fa.account_id = $1`,
    [accountId]
  );
  const row = res.rows[0];
  return {
    position_mode: row?.position_mode == null ? null : String(row.position_mode),
    leverage_override: row?.leverage_override == null ? null : String(row.leverage_override),
    group_code: row?.group_code == null ? null : String(row.group_code),
  };
}

/** Authoritative DB counts — not live engine valuation. */
async function loadRelatedAccounts(userId: string, currentAccountId: string) {
  const res = await db.query<{ account_id: string; status: string; currency: string }>(
    `SELECT account_id, status, currency FROM forex_accounts WHERE user_id = $1 ORDER BY created_at ASC LIMIT 20`,
    [userId],
  );
  return res.rows
    .map((r) => ({ account_id: String(r.account_id), status: String(r.status), currency: String(r.currency) }))
    .filter((r) => r.account_id !== currentAccountId);
}

async function loadFinanceSummary(accountId: string) {
  const [bal, pending, txCount] = await Promise.all([
    import('../ledger/persist.js').then((m) => m.customerCashBalanceFromDb(accountId)),
    db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_finance_requests WHERE account_id = $1 AND status IN ('PENDING','PROCESSING')`,
      [accountId],
    ),
    db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_ledger_transactions WHERE account_id = $1`,
      [accountId],
    ),
  ]);
  return {
    customer_cash_balance: bal,
    pending_finance_requests: Number.parseInt(pending.rows[0]?.n ?? '0', 10) || 0,
    ledger_transactions: Number.parseInt(txCount.rows[0]?.n ?? '0', 10) || 0,
    source: 'forex_ledger_transactions/forex_finance_requests',
  };
}

async function loadComplianceSummary(accountId: string) {
  const res = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_compliance_cases WHERE subject_type = 'ACCOUNT' AND subject_id = $1 AND status = 'OPEN'`,
    [accountId],
  );
  return {
    open_cases: Number.parseInt(res.rows[0]?.n ?? '0', 10) || 0,
    provider_status: 'NOT_CONNECTED' as const,
    source: 'forex_compliance_cases',
  };
}

async function loadPartnerSummary(accountId: string) {
  const res = await db.query<{ code: string; label: string }>(
    `SELECT p.code, p.label
     FROM forex_partner_attributions a
     JOIN forex_partner_profiles p ON p.partner_id = a.partner_id
     WHERE a.account_id = $1 AND (a.effective_to IS NULL OR a.effective_to > NOW())
     ORDER BY a.effective_from DESC
     LIMIT 1`,
    [accountId],
  );
  const row = res.rows[0];
  return {
    partner_code: row ? String(row.code) : null,
    partner_label: row ? String(row.label) : null,
    source: 'forex_partner_attributions',
  };
}

async function loadRecentNotifications(accountId: string) {
  const res = await db.query(
    `SELECT notification_id, title, severity, created_at
     FROM forex_operator_notifications
     WHERE resource_type = 'forex_order' OR resource_id = $1
     ORDER BY created_at DESC LIMIT 8`,
    [accountId],
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    notification_id: String(r.notification_id),
    title: String(r.title),
    severity: String(r.severity),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

async function loadTradingSummary(accountId: string) {
  const [orders, positions, executions] = await Promise.all([
    db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_orders
       WHERE account_id = $1 AND status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')`,
      [accountId],
    ),
    db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_positions WHERE account_id = $1 AND status = 'OPEN'`,
      [accountId],
    ),
    db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_executions
       WHERE account_id::text = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [accountId],
    ),
  ]);
  return {
    open_orders: Number.parseInt(orders.rows[0]?.n ?? '0', 10) || 0,
    open_positions: Number.parseInt(positions.rows[0]?.n ?? '0', 10) || 0,
    executions_30d: Number.parseInt(executions.rows[0]?.n ?? '0', 10) || 0,
    source: 'forex_orders/forex_positions/forex_executions',
  };
}

export async function buildForexAdminClient360(accountId: string, adminRole: string): Promise<ForexAdminClient360 | null> {
  const core = await buildForexAdminCrmClientDetail(accountId);
  if (!core) return null;
  const id = core.account_id;

  const { compliance: canCompliance, finance: canFinance, trading: canTrading } =
    resolveForexCrmSectionAccess(adminRole);

  const scopedCore = { ...core };
  if (!canCompliance) {
    scopedCore.kyc_status = null;
    scopedCore.kyc_level = null;
    scopedCore.risk_level = 'low';
    scopedCore.risk_flags = [];
  }
  if (!canFinance) {
    scopedCore.customer_cash_balance = 'REDACTED';
  }

  const userId = scopedCore.user_id;
  const [profile, tags, notes, tasks, activities, tradingRaw, tradingSummary, financeSummary, complianceSummary, partnerSummary, relatedAccounts, recentNotifications] =
    await Promise.all([
      loadProfile(id),
      loadTags(id),
      listForexCrmNotes(id, 30),
      loadTasks(id),
      loadActivities(id),
      loadTradingMeta(id),
      canTrading ? loadTradingSummary(id) : Promise.resolve(null),
      canFinance ? loadFinanceSummary(id) : Promise.resolve(null),
      canCompliance ? loadComplianceSummary(id) : Promise.resolve(null),
      loadPartnerSummary(id),
      loadRelatedAccounts(userId, id),
      loadRecentNotifications(id),
    ]);

  const trading = canTrading
    ? tradingRaw
    : { position_mode: null, group_code: null, leverage_override: null, restricted: true as const };

  return {
    core: scopedCore,
    profile,
    tags,
    notes,
    tasks: canTrading ? tasks : [],
    activities,
    trading_summary: canTrading ? tradingSummary : null,
    finance_summary: canFinance ? financeSummary : null,
    compliance_summary: canCompliance ? complianceSummary : null,
    partner_summary: partnerSummary,
    related_accounts: relatedAccounts,
    recent_notifications: recentNotifications,
    trading,
    permissions_hint: {
      compliance_fields: 'forex:compliance:view',
      finance_fields: 'forex:finance:view',
      trading_fields: 'forex:orders:view',
    },
    section_access: {
      compliance: canCompliance,
      finance: canFinance,
      trading: canTrading,
    },
  };
}
