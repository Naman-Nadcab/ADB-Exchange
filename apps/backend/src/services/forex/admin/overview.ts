/**
 * Read-only Forex ops counts for admin F1 (no mutations).
 */
import { db } from '../../../lib/database.js';

export type ForexAdminOverviewCounts = {
  openOrders: number;
  openPositions: number;
  ledgerAccounts: number;
};

export async function loadForexAdminOverviewCounts(): Promise<ForexAdminOverviewCounts> {
  const [orders, positions, accounts] = await Promise.all([
    db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_orders
       WHERE status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')`,
    ),
    db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM forex_positions WHERE status = 'OPEN'`),
    db.query<{ n: string }>(
      `SELECT COUNT(DISTINCT account_id)::text AS n FROM forex_ledger_entries`,
    ),
  ]);

  return {
    openOrders: Number.parseInt(orders.rows[0]?.n ?? '0', 10) || 0,
    openPositions: Number.parseInt(positions.rows[0]?.n ?? '0', 10) || 0,
    ledgerAccounts: Number.parseInt(accounts.rows[0]?.n ?? '0', 10) || 0,
  };
}
