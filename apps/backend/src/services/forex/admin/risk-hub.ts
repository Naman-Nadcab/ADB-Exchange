/**
 * Unified Forex risk hub — DB-backed aggregates (not live mark-to-market unless priced).
 */
import { db } from '../../../lib/database.js';
import { customerCashBalanceFromDb } from '../ledger/persist.js';

export async function buildForexRiskHubSnapshot(filters?: { symbol?: string; account_id?: string }) {
  const symbol = filters?.symbol?.trim().toUpperCase();
  const accountId = filters?.account_id?.trim();

  const posParams: unknown[] = [];
  const posWhere: string[] = ["p.status = 'OPEN'"];
  if (symbol) {
    posParams.push(symbol);
    posWhere.push(`p.symbol = $${posParams.length}`);
  }
  if (accountId) {
    posParams.push(accountId);
    posWhere.push(`p.account_id = $${posParams.length}`);
  }

  const exposure = await db.query<{ symbol: string; long_vol: string; short_vol: string; accounts: string }>(
    `SELECT p.symbol,
            COALESCE(SUM(CASE WHEN p.side = 'LONG' THEN p.volume ELSE 0 END), 0)::text AS long_vol,
            COALESCE(SUM(CASE WHEN p.side = 'SHORT' THEN p.volume ELSE 0 END), 0)::text AS short_vol,
            COUNT(DISTINCT p.account_id)::text AS accounts
     FROM forex_positions p
     WHERE ${posWhere.join(' AND ')}
     GROUP BY p.symbol
     ORDER BY p.symbol
     LIMIT 50`,
    posParams,
  );

  const firm = await db.query<{ open_positions: string; open_orders: string; accounts: string }>(
    `SELECT
       (SELECT COUNT(*)::text FROM forex_positions WHERE status = 'OPEN') AS open_positions,
       (SELECT COUNT(*)::text FROM forex_orders WHERE status NOT IN ('FILLED','REJECTED','CANCELLED','FAILED')) AS open_orders,
       (SELECT COUNT(*)::text FROM forex_accounts WHERE status = 'ACTIVE') AS accounts`,
  );

  const mtm = await db.query<{ unrealized: string | null; priced_positions: string }>(
    `SELECT
       COALESCE(SUM(
         CASE
           WHEN p.side = 'LONG' AND q.bid IS NOT NULL THEN (q.bid - p.entry_price) * p.volume
           WHEN p.side = 'SHORT' AND q.ask IS NOT NULL THEN (p.entry_price - q.ask) * p.volume
           ELSE 0
         END
       ), 0)::text AS unrealized,
       COUNT(*) FILTER (WHERE q.bid IS NOT NULL)::text AS priced_positions
     FROM forex_positions p
     LEFT JOIN forex_instruments i ON i.symbol = p.symbol
     LEFT JOIN forex_quotes q ON q.instrument_id = i.id
     WHERE p.status = 'OPEN'
       ${accountId ? 'AND p.account_id = $1' : ''}
       ${symbol ? (accountId ? 'AND p.symbol = $2' : 'AND p.symbol = $1') : ''}`,
    accountId && symbol ? [accountId, symbol] : accountId ? [accountId] : symbol ? [symbol] : [],
  );
  const unrealizedVal = mtm.rows[0]?.unrealized;
  const pricedCount = Number.parseInt(mtm.rows[0]?.priced_positions ?? '0', 10) || 0;

  let accountSlice: Record<string, unknown> | null = null;
  if (accountId) {
    const bal = await customerCashBalanceFromDb(accountId);
    const pos = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM forex_positions WHERE account_id = $1 AND status = 'OPEN'`,
      [accountId],
    );
    const equity =
      unrealizedVal != null && pricedCount > 0
        ? (Number.parseFloat(bal) + Number.parseFloat(unrealizedVal)).toFixed(8)
        : null;
    accountSlice = {
      account_id: accountId,
      customer_cash_balance: bal,
      open_positions: Number.parseInt(pos.rows[0]?.n ?? '0', 10) || 0,
      unrealized_pnl: pricedCount > 0 ? unrealizedVal : null,
      equity_estimate: equity,
      margin_level: null,
      valuation: pricedCount > 0 ? 'MOCK_QUOTES' : 'NOT_AVAILABLE',
    };
  }

  const gross = exposure.rows.reduce(
    (acc, r) => acc + Number.parseFloat(r.long_vol) + Number.parseFloat(r.short_vol),
    0,
  );
  const net = exposure.rows.reduce(
    (acc, r) => acc + Math.abs(Number.parseFloat(r.long_vol) - Number.parseFloat(r.short_vol)),
    0,
  );

  return {
    generated_at: new Date().toISOString(),
    filters: { symbol: symbol ?? null, account_id: accountId ?? null },
    firm: firm.rows[0] ?? {},
    exposure_summary: {
      gross_volume_lots: gross.toFixed(8),
      net_volume_lots: net.toFixed(8),
      symbol_rows: exposure.rows.length,
    },
    symbol_exposure: exposure.rows,
    account: accountSlice,
    unrealized_pnl: {
      status: pricedCount > 0 ? 'VERIFIED' : 'NOT_AVAILABLE',
      value: pricedCount > 0 ? unrealizedVal : null,
      priced_open_positions: pricedCount,
      source: 'forex_positions JOIN forex_quotes (MOCK)',
    },
  };
}
