/**
 * Per-account trade rights on the internal book.
 * Group leverage stays the default. This override is the account's own right.
 * DISABLED and CLOSE_ONLY still allow a reduce-only close.
 */
import { db } from '../../../lib/database.js';

export type ForexTradeRights = 'ENABLED' | 'CLOSE_ONLY' | 'DISABLED';

const rights = new Map<string, ForexTradeRights>();

export function resetForexTradeRightsForTests(): void {
  rights.clear();
}

export function rememberForexTradeRights(accountId: string, next: ForexTradeRights): void {
  rights.set(accountId.trim(), next);
}

export function getForexAccountTradeRights(accountId: string): ForexTradeRights {
  return rights.get(accountId.trim()) ?? 'ENABLED';
}

export function forexAccountEntryBlock(accountId: string, reduceOnly: boolean): { reason: 'ACCOUNT_RESTRICTED' | 'LIQUIDATION_ONLY'; detail: string } | null {
  const right = getForexAccountTradeRights(accountId);
  if (right === 'ENABLED' || reduceOnly) return null;
  if (right === 'CLOSE_ONLY') return { reason: 'LIQUIDATION_ONLY', detail: 'account is close only' };
  return { reason: 'ACCOUNT_RESTRICTED', detail: 'account trading is disabled' };
}

export async function hydrateForexAccountTradeRightsFromDb(): Promise<number> {
  try {
    const res = await db.query<{ account_id: string; trade_rights: string | null }>(
      `SELECT account_id, trade_rights FROM forex_accounts`,
    );
    rights.clear();
    for (const row of res.rows) {
      const value = String(row.trade_rights ?? 'ENABLED').toUpperCase();
      if (value === 'CLOSE_ONLY' || value === 'DISABLED' || value === 'ENABLED') {
        rights.set(String(row.account_id), value);
      }
    }
    return res.rows.length;
  } catch {
    return 0;
  }
}

export async function setForexAccountTradeRights(args: {
  accountId: string;
  tradeRights: string;
  adminId: string;
  reason: string;
}): Promise<{ account_id: string; previous: ForexTradeRights; next: ForexTradeRights }> {
  const next = args.tradeRights.trim().toUpperCase();
  if (next !== 'ENABLED' && next !== 'CLOSE_ONLY' && next !== 'DISABLED') throw new Error('INVALID_TRADE_RIGHTS');
  const accountId = args.accountId.trim();
  const prev = await db.query<{ trade_rights: string | null }>(
    `SELECT trade_rights FROM forex_accounts WHERE account_id = $1`,
    [accountId],
  );
  if (!prev.rows.length) throw new Error('ACCOUNT_NOT_FOUND');
  await db.query(`UPDATE forex_accounts SET trade_rights = $2, updated_at = NOW() WHERE account_id = $1`, [accountId, next]);
  const previous = (String(prev.rows[0]!.trade_rights ?? 'ENABLED').toUpperCase() || 'ENABLED') as ForexTradeRights;
  rememberForexTradeRights(accountId, next);
  await db.query(
    `INSERT INTO forex_crm_activities (account_id, kind, summary, actor_admin_id, metadata)
     VALUES ($1, 'trade_rights', $2, $3::uuid, $4::jsonb)`,
    [accountId, 'Trade rights updated', args.adminId, JSON.stringify({ previous, next, reason: args.reason })],
  );
  return { account_id: accountId, previous: previous === 'CLOSE_ONLY' || previous === 'DISABLED' ? previous : 'ENABLED', next };
}
