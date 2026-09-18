/**
 * Admin market-data control — latest quote snapshot per instrument (read-only).
 */
import { db } from '../../../lib/database.js';
import { forexConfig } from '../config.js';

export type ForexAdminQuoteRow = {
  symbol: string;
  asset_class: string;
  bid: string;
  ask: string;
  spread: string;
  spread_pips: string;
  quality: string;
  status: string;
  source: string;
  freshness: string;
  received_at: string;
  age_sec: number;
  stale: boolean;
};

export type ForexAdminMarketDataQuotesSnapshot = {
  rows: ForexAdminQuoteRow[];
  coverage: { total_instruments: number; quoted: number; stale: number; missing: number };
  worker_note: string;
  calculated_at: string;
};

export async function buildForexAdminMarketDataQuotesSnapshot(raw?: {
  symbol?: string;
  stale_only?: boolean;
}): Promise<ForexAdminMarketDataQuotesSnapshot> {
  const symbolFilter = raw?.symbol?.trim().toUpperCase();
  const staleOnly = raw?.stale_only === true;
  const staleMs = Math.max(5_000, forexConfig.marketDataIntervalMs * 3);

  const instCount = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM forex_instruments WHERE trading_status != 'DISABLED'`,
  );
  const totalInstruments = Number.parseInt(instCount.rows[0]?.n ?? '0', 10) || 0;

  const params: unknown[] = [];
  const clauses = ["i.trading_status != 'DISABLED'"];
  if (symbolFilter) {
    params.push(symbolFilter);
    clauses.push(`i.symbol = $${params.length}`);
  }

  const res = await db.query(
    `SELECT i.symbol, i.asset_class,
            q.bid, q.ask, q.spread, q.spread_pips, q.quality, q.status, q.source, q.freshness,
            q.received_timestamp
     FROM forex_instruments i
     LEFT JOIN forex_quotes q ON q.instrument_id = i.id
     WHERE ${clauses.join(' AND ')}
     ORDER BY i.symbol
     LIMIT 500`,
    params,
  );

  const now = Date.now();
  let quoted = 0;
  let staleCount = 0;
  const rows: ForexAdminQuoteRow[] = [];

  for (const r of res.rows as Record<string, unknown>[]) {
    const received = r.received_timestamp instanceof Date ? r.received_timestamp : r.received_timestamp ? new Date(String(r.received_timestamp)) : null;
    const ageSec = received && Number.isFinite(received.getTime()) ? Math.max(0, Math.floor((now - received.getTime()) / 1000)) : null;
    const stale = ageSec != null ? ageSec * 1000 > staleMs || String(r.freshness) === 'STALE' : true;

    if (r.bid != null) quoted += 1;
    if (stale && r.bid != null) staleCount += 1;
    if (staleOnly && !stale) continue;

    rows.push({
      symbol: String(r.symbol),
      asset_class: String(r.asset_class ?? '—'),
      bid: r.bid == null ? '—' : String(r.bid),
      ask: r.ask == null ? '—' : String(r.ask),
      spread: r.spread == null ? '—' : String(r.spread),
      spread_pips: r.spread_pips == null ? '—' : String(r.spread_pips),
      quality: r.quality == null ? 'UNAVAILABLE' : String(r.quality),
      status: r.status == null ? 'UNAVAILABLE' : String(r.status),
      source: r.source == null ? 'NOT_AVAILABLE' : String(r.source),
      freshness: r.freshness == null ? '—' : String(r.freshness),
      received_at: received ? received.toISOString() : '—',
      age_sec: ageSec ?? -1,
      stale,
    });
  }

  const missing = Math.max(0, totalInstruments - quoted);

  return {
    rows,
    coverage: { total_instruments: totalInstruments, quoted, stale: staleCount, missing },
    worker_note: 'SIMULATED/MOCK quotes when source is not LIVE · stale threshold = 3× worker interval',
    calculated_at: new Date().toISOString(),
  };
}
