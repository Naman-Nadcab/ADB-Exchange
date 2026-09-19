/**
 * Customer Forex accounts — list, create demo, active selection. Forex-only DB tables.
 */
import { randomBytes } from 'node:crypto';
import { db } from '../../../lib/database.js';
import { getForexAccountingService } from '../accounting/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';

export type ForexCustomerAccountRow = {
  accountId: string;
  userId: string;
  currency: string;
  status: string;
  accountKind: string;
  positionMode: string;
  leverageOverride: string | null;
  createdAt: string;
  updatedAt: string;
};

function rowToAccount(r: Record<string, unknown>): ForexCustomerAccountRow {
  return {
    accountId: String(r.account_id),
    userId: String(r.user_id),
    currency: String(r.currency ?? 'USD'),
    status: String(r.status ?? 'ACTIVE'),
    accountKind: String(r.account_kind ?? 'DEMO'),
    positionMode: String(r.position_mode ?? 'NETTING'),
    leverageOverride: r.leverage_override != null ? String(r.leverage_override) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listForexAccountsForUser(userId: string): Promise<ForexCustomerAccountRow[]> {
  await ensureLegacyForexAccountRow(userId);
  const res = await db.query(
    `SELECT account_id, user_id, currency, status,
            COALESCE(account_kind, 'DEMO') AS account_kind,
            COALESCE(position_mode, 'NETTING') AS position_mode,
            leverage_override,
            created_at, updated_at
     FROM forex_accounts
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return res.rows.map((r) => rowToAccount(r as Record<string, unknown>));
}

export async function userOwnsForexAccount(userId: string, accountId: string): Promise<boolean> {
  const res = await db.query(`SELECT 1 FROM forex_accounts WHERE account_id = $1 AND user_id = $2 LIMIT 1`, [
    accountId,
    userId,
  ]);
  return (res.rowCount ?? 0) > 0;
}

/** Legacy default: account_id === user_id when that row exists. */
export async function getDefaultForexAccountIdForUser(userId: string): Promise<string> {
  await ensureLegacyForexAccountRow(userId);
  const active = await db.query<{ account_id: string }>(
    `SELECT account_id FROM forex_customer_active_account WHERE user_id = $1`,
    [userId]
  );
  if (active.rows[0]?.account_id) {
    const id = String(active.rows[0].account_id);
    if (await userOwnsForexAccount(userId, id)) return id;
  }
  const legacy = await db.query<{ account_id: string }>(
    `SELECT account_id FROM forex_accounts WHERE user_id = $1 AND account_id = $2 LIMIT 1`,
    [userId, userId]
  );
  if (legacy.rows[0]) return userId;
  const first = await db.query<{ account_id: string }>(
    `SELECT account_id FROM forex_accounts WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );
  if (first.rows[0]) return String(first.rows[0].account_id);
  return userId;
}

export async function ensureLegacyForexAccountRow(userId: string): Promise<void> {
  const legacy = await db.query(`SELECT 1 FROM forex_accounts WHERE account_id = $1`, [userId]);
  if ((legacy.rowCount ?? 0) > 0) return;
  const any = await db.query(`SELECT 1 FROM forex_accounts WHERE user_id = $1 LIMIT 1`, [userId]);
  if ((any.rowCount ?? 0) > 0) return;
  await db.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, account_kind)
     VALUES ($1, $2, 'USD', 'ACTIVE', 'NETTING', 'DEMO')
     ON CONFLICT (account_id) DO NOTHING`,
    [userId, userId]
  );
  const pricing = getForexPricingService();
  getForexAccountingService(getForexPositionService(pricing), pricing).ensureAccount(userId);
}

export async function setActiveForexAccountForUser(userId: string, accountId: string): Promise<void> {
  if (!(await userOwnsForexAccount(userId, accountId))) {
    throw new Error('FOREX_ACCOUNT_FORBIDDEN');
  }
  await db.query(
    `INSERT INTO forex_customer_active_account (user_id, account_id, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET account_id = EXCLUDED.account_id, updated_at = CURRENT_TIMESTAMP`,
    [userId, accountId]
  );
}

function newDemoAccountId(): string {
  return `FX${randomBytes(5).toString('hex').toUpperCase()}`;
}

export async function createForexDemoAccount(userId: string): Promise<ForexCustomerAccountRow> {
  const accountId = newDemoAccountId();
  let attempts = 0;
  while (attempts < 5) {
    const exists = await db.query(`SELECT 1 FROM forex_accounts WHERE account_id = $1`, [accountId]);
    if ((exists.rowCount ?? 0) === 0) break;
    attempts += 1;
  }
  await db.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, account_kind)
     VALUES ($1, $2, 'USD', 'ACTIVE', 'NETTING', 'DEMO')`,
    [accountId, userId]
  );
  const pricing = getForexPricingService();
  getForexAccountingService(getForexPositionService(pricing), pricing).ensureAccount(accountId);
  await setActiveForexAccountForUser(userId, accountId);
  const rows = await listForexAccountsForUser(userId);
  const created = rows.find((a) => a.accountId === accountId);
  if (!created) throw new Error('FOREX_ACCOUNT_CREATE_FAILED');
  return created;
}

export async function resolveForexAccountIdForUser(userId: string, hint?: string): Promise<string> {
  if (hint?.trim()) {
    const id = hint.trim();
    if (!(await userOwnsForexAccount(userId, id))) {
      throw new Error('FOREX_ACCOUNT_FORBIDDEN');
    }
    return id;
  }
  return getDefaultForexAccountIdForUser(userId);
}
