/**
 * Convert / swap rate resolution.
 *
 * Priority:
 *   1. `market_prices` (external oracle, when PRICE_ORACLE_ENABLED populates it)
 *   2. the venue's own Spot market: last `spot_trades` print for BASE_QUOTE, direct, reverse,
 *      or via the two USDT legs. This is the internal venue price, not a third-party feed.
 *
 * Every leg carries the timestamp it was observed at so callers can refuse stale prices.
 */
import { Decimal, type DecimalInstance } from '../lib/decimal.js';
import { db } from '../lib/database.js';

const RATE_PRECISION = 18;
const ROUND_DOWN = Decimal.ROUND_DOWN;

type QueryRows<T> = { rows: T[] };
/** Either the pool wrapper or a transaction client; only the (text, values) overload is used. */
type Queryable = { query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryRows<T>> };

export interface ResolvedConvertRate {
  rate: DecimalInstance;
  /** Oldest observation among the legs used; null when unknown. */
  oldestObservedAt: Date | null;
  source: 'oracle' | 'spot_last_trade' | 'oracle+spot';
  legs: string[];
}

interface Leg {
  price: DecimalInstance;
  observedAt: Date | null;
  source: 'oracle' | 'spot_last_trade';
  label: string;
}

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function oracleLeg(q: Queryable, baseSymbol: string, quoteSymbol: string): Promise<Leg | null> {
  const r = await q.query<{ price: string; last_updated: string | null }>(
    `SELECT mp.price::text, mp.last_updated
       FROM market_prices mp
       JOIN currencies bc ON mp.base_currency_id = bc.id
       JOIN currencies qc ON mp.quote_currency_id = qc.id
      WHERE UPPER(bc.symbol) = UPPER($1) AND UPPER(qc.symbol) = UPPER($2)
      ORDER BY mp.last_updated DESC NULLS LAST
      LIMIT 1`,
    [baseSymbol, quoteSymbol],
  );
  const row = r.rows[0];
  if (!row) return null;
  const price = new Decimal(row.price);
  if (!price.isFinite() || price.lte(0)) return null;
  return { price, observedAt: toDate(row.last_updated), source: 'oracle', label: `oracle:${baseSymbol}_${quoteSymbol}` };
}

async function spotLeg(q: Queryable, baseSymbol: string, quoteSymbol: string): Promise<Leg | null> {
  const market = `${baseSymbol.toUpperCase()}_${quoteSymbol.toUpperCase()}`;
  const r = await q.query<{ price: string; created_at: string }>(
    `SELECT st.price::text, st.created_at
       FROM spot_trades st
      WHERE st.market = $1
      ORDER BY st.created_at DESC
      LIMIT 1`,
    [market],
  );
  const row = r.rows[0];
  if (!row) return null;
  const price = new Decimal(row.price);
  if (!price.isFinite() || price.lte(0)) return null;
  return { price, observedAt: toDate(row.created_at), source: 'spot_last_trade', label: `spot:${market}` };
}

/** Direct BASE/QUOTE leg from oracle first, then internal spot. */
async function directLeg(q: Queryable, baseSymbol: string, quoteSymbol: string): Promise<Leg | null> {
  return (await oracleLeg(q, baseSymbol, quoteSymbol)) ?? (await spotLeg(q, baseSymbol, quoteSymbol));
}

function invert(leg: Leg): Leg {
  return { ...leg, price: new Decimal(1).div(leg.price), label: `${leg.label}^-1` };
}

function combine(legs: Leg[]): ResolvedConvertRate {
  let rate = new Decimal(1);
  let oldest: Date | null = null;
  const sources = new Set<Leg['source']>();
  for (const leg of legs) {
    rate = rate.times(leg.price);
    sources.add(leg.source);
    if (leg.observedAt && (oldest === null || leg.observedAt < oldest)) oldest = leg.observedAt;
  }
  const source: ResolvedConvertRate['source'] =
    sources.size === 2 ? 'oracle+spot' : sources.has('oracle') ? 'oracle' : 'spot_last_trade';
  return {
    rate: rate.toDecimalPlaces(RATE_PRECISION, ROUND_DOWN),
    oldestObservedAt: oldest,
    source,
    legs: legs.map((l) => l.label),
  };
}

/**
 * Resolve how many `to` units one `from` unit buys. Returns null when no price exists.
 */
export async function resolveConvertRate(
  fromSymbol: string,
  toSymbol: string,
  q: Queryable = db,
): Promise<ResolvedConvertRate | null> {
  const from = fromSymbol.toUpperCase();
  const to = toSymbol.toUpperCase();
  if (from === to) return { rate: new Decimal(1), oldestObservedAt: new Date(), source: 'oracle', legs: ['identity'] };

  const direct = await directLeg(q, from, to);
  if (direct) return combine([direct]);

  const reverse = await directLeg(q, to, from);
  if (reverse) return combine([invert(reverse)]);

  if (from !== 'USDT' && to !== 'USDT') {
    const fromUsdt = await directLeg(q, from, 'USDT');
    const toUsdt = await directLeg(q, to, 'USDT');
    if (fromUsdt && toUsdt) return combine([fromUsdt, invert(toUsdt)]);
  }
  return null;
}
