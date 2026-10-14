/**
 * Read-only dealing operational queue (MOCK execution — no manual accept/reject).
 */
import { db } from '../../../lib/database.js';
import { isLiveForexAccount, refreshLiveForexAccountIds } from '../broker/account-kind.js';
import { executableQuoteForAccount } from '../broker/gateway.js';
import { getForexPricingService } from '../quotes.service.js';

const QUEUE_STATUSES = [
  'NEW',
  'VALIDATING',
  'ACCEPTED',
  'PENDING',
  'TRIGGERING',
  'ROUTING',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'CANCEL_PENDING',
] as const;

export type ForexDealingQueueRow = {
  order_id: string;
  account_id: string;
  user_id: string | null;
  symbol: string;
  side: string;
  requested_volume: string;
  requested_price: string | null;
  current_price: string | null;
  status: string;
  execution_mode: string;
  failure_reason: string | null;
  execution_id: string | null;
  age_sec: number;
  price_source: 'NOT_AVAILABLE' | 'MOCK' | 'BROKER';
};

export async function listForexDealingQueue(raw: {
  page?: string;
  limit?: string;
  symbol?: string;
  account_id?: string;
}): Promise<{ rows: ForexDealingQueueRow[]; pagination: { page: number; limit: number; total: number; totalPages: number }; note: string }> {
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(raw.limit ?? '25', 10) || 25));
  const offset = (page - 1) * limit;
  const params: unknown[] = [QUEUE_STATUSES];
  const clauses = [`o.status = ANY($1::text[])`];
  if (raw.symbol?.trim()) {
    params.push(raw.symbol.trim().toUpperCase());
    clauses.push(`o.symbol = $${params.length}`);
  }
  if (raw.account_id?.trim()) {
    params.push(raw.account_id.trim());
    clauses.push(`o.account_id = $${params.length}`);
  }
  const where = clauses.join(' AND ');
  const count = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_orders o WHERE ${where}`,
    params,
  );
  const total = Number.parseInt(count.rows[0]?.n ?? '0', 10) || 0;
  params.push(limit, offset);
  const res = await db.query(
    `SELECT o.order_id, o.account_id, fa.user_id, o.symbol, o.side, o.requested_volume, o.requested_price,
            o.status, o.execution_mode, o.failure_reason, o.execution_id, o.created_at
     FROM forex_orders o
     LEFT JOIN forex_accounts fa ON fa.account_id = o.account_id
     WHERE ${where}
     ORDER BY o.created_at ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  try {
    await refreshLiveForexAccountIds();
  } catch {
    /* a missing account table still leaves the queue readable */
  }
  const pricing = getForexPricingService();
  const now = Date.now();
  const rows: ForexDealingQueueRow[] = res.rows.map((r: Record<string, unknown>) => {
    const created = r.created_at instanceof Date ? r.created_at.getTime() : Date.parse(String(r.created_at));
    const accountId = String(r.account_id);
    const symbol = String(r.symbol);
    const side = String(r.side);
    const quote = executableQuoteForAccount(pricing, accountId, symbol);
    const live = isLiveForexAccount(accountId);
    const current = quote ? (side === 'sell' ? quote.bid : quote.ask) : null;
    return {
      order_id: String(r.order_id),
      account_id: accountId,
      user_id: r.user_id == null ? null : String(r.user_id),
      symbol,
      side,
      requested_volume: String(r.requested_volume),
      requested_price: r.requested_price == null ? null : String(r.requested_price),
      current_price: current,
      status: String(r.status),
      execution_mode: String(r.execution_mode ?? 'MOCK'),
      failure_reason: r.failure_reason == null ? null : String(r.failure_reason),
      execution_id: r.execution_id == null ? null : String(r.execution_id),
      age_sec: Number.isFinite(created) ? Math.max(0, Math.floor((now - created) / 1000)) : 0,
      price_source: current == null ? 'NOT_AVAILABLE' : live ? 'BROKER' : 'MOCK',
    };
  });
  return {
    rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    note: 'Queue price is the executable quote (broker for a live account, mock for demo). Accept audits only and does not invent a fill.',
  };
}
