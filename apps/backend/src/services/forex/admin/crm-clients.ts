/**
 * Admin Forex CRM S3 — read-only client list (forex_accounts + platform user link).
 */
import { db } from '../../../lib/database.js';
import { customerCashBalanceFromDb } from '../ledger/persist.js';
import {
  CRM_USER_AML_COUNT_SQL,
  CRM_USER_KYC_LEVEL_SQL,
  CRM_USER_KYC_STATUS_SQL,
  CRM_USER_LOGIN_FAIL_SQL,
  CRM_USER_WITHDRAWAL_30D_SQL,
  deriveForexCrmUserCompliance,
  type ForexCrmUserRiskLevel,
} from './crm-user-compliance.js';
import {
  resolveForexCrmSectionAccess,
  scopeForexCrmClientDetail,
  type ForexCrmSectionAccess,
} from './crm-client-scope.js';

export type ForexAdminCrmClientRow = {
  account_id: string;
  user_id: string;
  email: string | null;
  phone: string | null;
  user_status: string | null;
  account_status: string;
  currency: string;
  customer_cash_balance: string;
  open_positions: number;
  account_created_at: string;
  kyc_status: string | null;
  kyc_level: number | null;
  risk_level: ForexCrmUserRiskLevel;
  risk_flags: string[];
};

export type ForexAdminCrmClientsSnapshot = {
  rows: ForexAdminCrmClientRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  note: string;
};

async function loadRecentJournalForAccount(accountId: string) {
  const table = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forex_journal_events' LIMIT 1`,
  );
  if (!table.rows.length) return [] as Record<string, unknown>[];
  const jRes = await db.query(
    `SELECT id, severity, event_type, message, created_at
     FROM forex_journal_events
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [accountId],
  );
  return jRes.rows as Record<string, unknown>[];
}

function clampPageLimit(raw: { page?: string; limit?: string }): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(raw.limit ?? '50', 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

function buildCrmListFilters(raw: {
  q?: string;
  account_status?: string;
  user_status?: string;
  has_open_positions?: string;
  kyc_status?: string;
  risk_level?: string;
}): { whereSql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  const search = (raw.q ?? '').trim().toLowerCase();
  if (search) {
    params.push(`%${search.replace(/[%_\\]/g, '\\$&')}%`);
    const i = params.length;
    clauses.push(`(
      LOWER(fa.account_id) LIKE $${i} ESCAPE '\\'
      OR LOWER(fa.user_id) LIKE $${i} ESCAPE '\\'
      OR LOWER(COALESCE(u.email, '')) LIKE $${i} ESCAPE '\\'
      OR LOWER(COALESCE(u.phone, '')) LIKE $${i} ESCAPE '\\'
    )`);
  }

  const accountStatus = (raw.account_status ?? '').trim();
  if (accountStatus) {
    params.push(accountStatus.toUpperCase());
    clauses.push(`UPPER(fa.status) = $${params.length}`);
  }

  const userStatus = (raw.user_status ?? '').trim();
  if (userStatus) {
    params.push(userStatus.toLowerCase());
    clauses.push(`LOWER(u.status) = $${params.length}`);
  }

  const hasOpen = (raw.has_open_positions ?? '').trim().toLowerCase();
  if (hasOpen === '1' || hasOpen === 'true' || hasOpen === 'yes') {
    clauses.push(`EXISTS (
      SELECT 1 FROM forex_positions fp
      WHERE fp.account_id = fa.account_id AND fp.status = 'OPEN'
    )`);
  } else if (hasOpen === '0' || hasOpen === 'false' || hasOpen === 'no') {
    clauses.push(`NOT EXISTS (
      SELECT 1 FROM forex_positions fp
      WHERE fp.account_id = fa.account_id AND fp.status = 'OPEN'
    )`);
  }

  const kycStatus = (raw.kyc_status ?? '').trim().toLowerCase();
  if (kycStatus && kycStatus !== 'all') {
    if (kycStatus === 'none') {
      clauses.push(`${CRM_USER_KYC_STATUS_SQL} IS NULL`);
    } else {
      params.push(kycStatus);
      clauses.push(`LOWER(COALESCE(${CRM_USER_KYC_STATUS_SQL}, '')) = $${params.length}`);
    }
  }

  const riskLevel = (raw.risk_level ?? '').trim().toLowerCase();
  if (riskLevel === 'high') {
    clauses.push(`${CRM_USER_AML_COUNT_SQL} > 0`);
  } else if (riskLevel === 'medium') {
    clauses.push(`${CRM_USER_AML_COUNT_SQL} = 0`);
    clauses.push(`${CRM_USER_LOGIN_FAIL_SQL} > 2`);
  } else if (riskLevel === 'low') {
    clauses.push(`${CRM_USER_AML_COUNT_SQL} = 0`);
    clauses.push(`${CRM_USER_LOGIN_FAIL_SQL} <= 2`);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereSql, params };
}

export async function buildForexAdminCrmClientsSnapshot(raw: {
  page?: string;
  limit?: string;
  q?: string;
  account_status?: string;
  user_status?: string;
  has_open_positions?: string;
  kyc_status?: string;
  risk_level?: string;
}): Promise<ForexAdminCrmClientsSnapshot> {
  const { page, limit, offset } = clampPageLimit(raw);
  const { whereSql: whereClause, params: filterParams } = buildCrmListFilters(raw);
  const countParams = [...filterParams];
  const countRes = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM forex_accounts fa
     LEFT JOIN users u ON u.id::text = fa.user_id AND u.deleted_at IS NULL
     ${whereClause}`,
    countParams,
  );
  const total = Number.parseInt(countRes.rows[0]?.n ?? '0', 10) || 0;

  const listParams = [...filterParams, limit, offset];
  const limitIdx = filterParams.length + 1;
  const offsetIdx = filterParams.length + 2;

  const listRes = await db.query<{
    account_id: string;
    user_id: string;
    currency: string;
    account_status: string;
    account_created_at: Date;
    email: string | null;
    phone: string | null;
    user_status: string | null;
    open_positions: string;
    kyc_status: string | null;
    kyc_level: number | null;
    aml_alert_count: number;
    login_fail_7d: number;
    withdrawal_count_30d: number;
  }>(
    `SELECT
       fa.account_id,
       fa.user_id,
       fa.currency,
       fa.status AS account_status,
       fa.created_at AS account_created_at,
       u.email,
       u.phone,
       u.status AS user_status,
       COALESCE((
         SELECT COUNT(*)::text FROM forex_positions fp
         WHERE fp.account_id = fa.account_id AND fp.status = 'OPEN'
       ), '0') AS open_positions,
       ${CRM_USER_KYC_STATUS_SQL} AS kyc_status,
       ${CRM_USER_KYC_LEVEL_SQL} AS kyc_level,
       ${CRM_USER_AML_COUNT_SQL} AS aml_alert_count,
       ${CRM_USER_LOGIN_FAIL_SQL} AS login_fail_7d,
       ${CRM_USER_WITHDRAWAL_30D_SQL} AS withdrawal_count_30d
     FROM forex_accounts fa
     LEFT JOIN users u ON u.id::text = fa.user_id AND u.deleted_at IS NULL
     ${whereClause}
     ORDER BY fa.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  );

  const rows: ForexAdminCrmClientRow[] = [];
  for (const row of listRes.rows) {
    const accountId = String(row.account_id);
    const balance = await customerCashBalanceFromDb(accountId);
    const compliance = deriveForexCrmUserCompliance({
      kyc_status: row.kyc_status == null ? null : String(row.kyc_status),
      kyc_level: row.kyc_level == null ? null : Number(row.kyc_level),
      aml_alert_count: Number(row.aml_alert_count) || 0,
      login_fail_7d: Number(row.login_fail_7d) || 0,
      withdrawal_count_30d: Number(row.withdrawal_count_30d) || 0,
    });
    rows.push({
      account_id: accountId,
      user_id: String(row.user_id),
      email: row.email == null ? null : String(row.email),
      phone: row.phone == null ? null : String(row.phone),
      user_status: row.user_status == null ? null : String(row.user_status),
      account_status: String(row.account_status),
      currency: String(row.currency),
      customer_cash_balance: balance,
      open_positions: Number.parseInt(String(row.open_positions), 10) || 0,
      account_created_at:
        row.account_created_at instanceof Date
          ? row.account_created_at.toISOString()
          : String(row.account_created_at),
      kyc_status: compliance.kyc_status,
      kyc_level: compliance.kyc_level,
      risk_level: compliance.risk_level,
      risk_flags: compliance.risk_flags,
    });
  }

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    rows,
    pagination: { page, limit, total, totalPages },
    note: 'Forex CRM clients — balances from Forex ledger · not Crypto',
  };
}

export async function buildForexAdminCrmClientsSnapshotForAdmin(
  adminRole: string,
  raw: Parameters<typeof buildForexAdminCrmClientsSnapshot>[0],
): Promise<ForexAdminCrmClientsSnapshot & { section_access: ForexCrmSectionAccess }> {
  const snapshot = await buildForexAdminCrmClientsSnapshot(raw);
  const access = resolveForexCrmSectionAccess(adminRole);
  const rows = snapshot.rows.map((row) => {
    const copy = { ...row };
    if (!access.finance) copy.customer_cash_balance = 'REDACTED';
    if (!access.compliance) {
      copy.kyc_status = null;
      copy.kyc_level = null;
      copy.risk_level = 'low';
      copy.risk_flags = [];
    }
    if (!access.trading) copy.open_positions = 0;
    return copy;
  });
  return { ...snapshot, rows, section_access: access };
}

export type ForexAdminCrmClientDetail = {
  account_id: string;
  user_id: string;
  email: string | null;
  phone: string | null;
  user_status: string | null;
  email_verified: boolean | null;
  account_status: string;
  currency: string;
  customer_cash_balance: string;
  open_orders: number;
  open_positions: number;
  account_created_at: string;
  kyc_status: string | null;
  kyc_level: number | null;
  risk_level: ForexCrmUserRiskLevel;
  risk_flags: string[];
  recent_journal: Array<{
    id: string;
    severity: string;
    event_type: string;
    message: string;
    created_at: string;
  }>;
};

export async function buildForexAdminCrmClientDetailScoped(
  accountId: string,
  adminRole: string,
): Promise<(ForexAdminCrmClientDetail & { section_access: ForexCrmSectionAccess }) | null> {
  const detail = await buildForexAdminCrmClientDetail(accountId);
  if (!detail) return null;
  return scopeForexCrmClientDetail(detail, resolveForexCrmSectionAccess(adminRole));
}

export async function buildForexAdminCrmClientDetail(accountId: string): Promise<ForexAdminCrmClientDetail | null> {
  const id = accountId.trim();
  if (!id) return null;

  const rowRes = await db.query<{
    account_id: string;
    user_id: string;
    currency: string;
    account_status: string;
    account_created_at: Date;
    email: string | null;
    phone: string | null;
    user_status: string | null;
    email_verified: boolean | null;
  }>(
    `SELECT
       fa.account_id,
       fa.user_id,
       fa.currency,
       fa.status AS account_status,
       fa.created_at AS account_created_at,
       u.email,
       u.phone,
       u.status AS user_status,
       u.email_verified
     FROM forex_accounts fa
     LEFT JOIN users u ON u.id::text = fa.user_id AND u.deleted_at IS NULL
     WHERE fa.account_id = $1
     LIMIT 1`,
    [id],
  );
  const row = rowRes.rows[0];
  if (!row) return null;

  const [balance, orders, positions, journalRows, complianceRow] = await Promise.all([
    customerCashBalanceFromDb(id),
    db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_orders
       WHERE account_id = $1 AND status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')`,
      [id],
    ),
    db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_positions WHERE account_id = $1 AND status = 'OPEN'`,
      [id],
    ),
    loadRecentJournalForAccount(id),
    db.query<{
      kyc_status: string | null;
      kyc_level: number | null;
      aml_alert_count: number;
      login_fail_7d: number;
      withdrawal_count_30d: number;
    }>(
      `SELECT
         ${CRM_USER_KYC_STATUS_SQL} AS kyc_status,
         ${CRM_USER_KYC_LEVEL_SQL} AS kyc_level,
         ${CRM_USER_AML_COUNT_SQL} AS aml_alert_count,
         ${CRM_USER_LOGIN_FAIL_SQL} AS login_fail_7d,
         ${CRM_USER_WITHDRAWAL_30D_SQL} AS withdrawal_count_30d
       FROM forex_accounts fa
       WHERE fa.account_id = $1`,
      [id],
    ),
  ]);

  const compRaw = complianceRow.rows[0];
  const compliance = deriveForexCrmUserCompliance({
    kyc_status: compRaw?.kyc_status == null ? null : String(compRaw.kyc_status),
    kyc_level: compRaw?.kyc_level == null ? null : Number(compRaw.kyc_level),
    aml_alert_count: Number(compRaw?.aml_alert_count) || 0,
    login_fail_7d: Number(compRaw?.login_fail_7d) || 0,
    withdrawal_count_30d: Number(compRaw?.withdrawal_count_30d) || 0,
  });

  return {
    account_id: String(row.account_id),
    user_id: String(row.user_id),
    email: row.email == null ? null : String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    user_status: row.user_status == null ? null : String(row.user_status),
    email_verified: row.email_verified == null ? null : Boolean(row.email_verified),
    account_status: String(row.account_status),
    currency: String(row.currency),
    customer_cash_balance: balance,
    open_orders: Number.parseInt(orders.rows[0]?.n ?? '0', 10) || 0,
    open_positions: Number.parseInt(positions.rows[0]?.n ?? '0', 10) || 0,
    account_created_at:
      row.account_created_at instanceof Date ? row.account_created_at.toISOString() : String(row.account_created_at),
    kyc_status: compliance.kyc_status,
    kyc_level: compliance.kyc_level,
    risk_level: compliance.risk_level,
    risk_flags: compliance.risk_flags,
    recent_journal: journalRows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      severity: String(r.severity),
      event_type: String(r.event_type),
      message: String(r.message),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    })),
  };
}
