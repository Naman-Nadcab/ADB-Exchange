/**
 * Live Forex valuation from the centralized quote stream.
 * LONG closes at BID. SHORT closes at ASK. Mid is never used.
 * Does not poll. Callers pass the current store quote.
 */
import type { ForexInstrument, ForexPublicPosition, ForexQuoteDto } from './types';
import { isQuoteStale } from './quotes';

export type LivePnlStatus = 'CALCULATED' | 'PRICE_UNAVAILABLE' | 'STALE_PRICE' | 'INVALID';

export interface LivePositionValuation {
  status: LivePnlStatus;
  symbol: string;
  side: ForexPublicPosition['side'];
  bid: string | null;
  ask: string | null;
  mark: string | null;
  markSource: 'BID' | 'ASK' | null;
  entry: string;
  volume: string;
  contractSize: string;
  usedMargin: string;
  commission: string;
  swap: string;
  floating: string | null;
  floatingPct: string | null;
  net: string | null;
  currency: string;
  ageMs: number | null;
  reason?: string;
}

function dec(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function money(n: number): string {
  return n.toFixed(2);
}

export function quoteClosePrice(
  side: ForexPublicPosition['side'],
  quote: ForexQuoteDto | undefined
): { price: string; source: 'BID' | 'ASK' } | null {
  if (!quote) return null;
  return side === 'long' ? { price: quote.bid, source: 'BID' } : { price: quote.ask, source: 'ASK' };
}

export function instrumentCommission(inst: ForexInstrument | undefined, volume: string): string {
  const rate = dec(inst?.commission) ?? 0;
  const vol = dec(volume) ?? 0;
  if (rate === 0 || vol <= 0) return '0';
  if ((inst?.commissionType ?? 'per_lot') === 'per_lot') return money(rate * vol);
  return money(rate);
}

export function instrumentSwapAccrued(inst: ForexInstrument | undefined, side: ForexPublicPosition['side']): string {
  const raw = side === 'long' ? inst?.swapLong : inst?.swapShort;
  const n = dec(raw);
  return n == null ? '0' : String(n);
}

export function positionAgeMs(openedAt: string | undefined, now = Date.now()): number | null {
  if (!openedAt) return null;
  const t = Date.parse(openedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}

export function formatPositionAge(ms: number | null): string {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 48) return `${h}h${rm ? ` ${rm}m` : ''}`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function formatMarginLevel(equity: string | number | null | undefined, used: string | number | null | undefined): string {
  const e = dec(equity);
  const u = dec(used);
  if (e == null || u == null) return '—';
  if (u === 0) return '—';
  return `${((e / u) * 100).toFixed(2)}%`;
}

/**
 * Quote-currency floating P&L, then treated as account P&L when quote is USD
 * or when no conversion quote is supplied. Never fabricates a cross rate.
 */
export function livePositionValuation(args: {
  position: ForexPublicPosition;
  quote: ForexQuoteDto | undefined;
  instrument?: ForexInstrument;
  conversionRate?: number | null;
  accountCommission?: string;
  accountSwap?: string;
  now?: number;
}): LivePositionValuation {
  const p = args.position;
  const entry = dec(p.averageEntryPrice || p.entryPrice);
  const volume = dec(p.volume);
  const cs = dec(p.contractSize ?? args.instrument?.contractSize);
  const commission = args.accountCommission ?? instrumentCommission(args.instrument, p.volume);
  const swap = args.accountSwap ?? instrumentSwapAccrued(args.instrument, p.side);
  const used = p.initialMargin ?? '';
  const base: LivePositionValuation = {
    status: 'PRICE_UNAVAILABLE',
    symbol: p.symbol,
    side: p.side,
    bid: args.quote?.bid ?? null,
    ask: args.quote?.ask ?? null,
    mark: null,
    markSource: null,
    entry: p.averageEntryPrice || p.entryPrice,
    volume: p.volume,
    contractSize: p.contractSize ?? args.instrument?.contractSize ?? '',
    usedMargin: used,
    commission,
    swap,
    floating: null,
    floatingPct: null,
    net: null,
    currency: args.instrument?.quoteCurrency ?? 'USD',
    ageMs: positionAgeMs(p.openedAt, args.now),
  };
  if (entry == null || volume == null || volume <= 0 || cs == null || cs <= 0) {
    return { ...base, status: 'INVALID', reason: 'INVALID_POSITION' };
  }
  if (!args.quote) return { ...base, status: 'PRICE_UNAVAILABLE', reason: 'PRICE_UNAVAILABLE' };
  if (isQuoteStale(args.quote)) {
    return { ...base, status: 'STALE_PRICE', bid: args.quote.bid, ask: args.quote.ask, reason: 'STALE_PRICE' };
  }
  const close = quoteClosePrice(p.side, args.quote);
  if (!close) return { ...base, status: 'PRICE_UNAVAILABLE', reason: 'PRICE_UNAVAILABLE' };
  const mark = dec(close.price);
  if (mark == null || mark <= 0) return { ...base, status: 'PRICE_UNAVAILABLE', reason: 'PRICE_UNAVAILABLE' };
  const quotePnl = p.side === 'long' ? (mark - entry) * volume * cs : (entry - mark) * volume * cs;
  const rate = args.conversionRate;
  const accountPnl = rate != null && Number.isFinite(rate) && rate > 0 ? quotePnl * rate : quotePnl;
  const comm = dec(commission) ?? 0;
  const sw = dec(swap) ?? 0;
  const net = accountPnl - comm - sw;
  const margin = dec(used);
  return {
    ...base,
    status: 'CALCULATED',
    bid: args.quote.bid,
    ask: args.quote.ask,
    mark: close.price,
    markSource: close.source,
    floating: money(accountPnl),
    floatingPct: margin != null && margin > 0 ? ((accountPnl / margin) * 100).toFixed(2) : null,
    net: money(net),
    currency: rate != null ? 'USD' : base.currency,
  };
}

export function sumLiveFloating(rows: LivePositionValuation[]): { available: boolean; value: string } {
  let sum = 0;
  for (const r of rows) {
    if (r.status !== 'CALCULATED' || r.floating == null) return { available: false, value: '' };
    sum += Number(r.floating);
  }
  return { available: true, value: money(sum) };
}
