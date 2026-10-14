/**
 * Normalize backend exposure + live position P&L into an MT-style book.
 * Notionals come from server position.exposure. P&L comes from live valuation.
 */
import type { ForexPublicPosition } from './types';
import type { LivePositionValuation } from './live-valuation';

export interface SymbolExposureRow {
  symbol: string;
  longVolume: string;
  shortVolume: string;
  netVolume: string;
  longNotional: string;
  shortNotional: string;
  netNotional: string;
  longPnl: string;
  shortPnl: string;
}

export interface ExposureBook {
  grossNotional: string;
  netNotional: string;
  longNotional: string;
  shortNotional: string;
  longPnl: string;
  shortPnl: string;
  bySymbol: SymbolExposureRow[];
}

function dec(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return n.toFixed(2);
}

function lots(n: number): string {
  return n.toFixed(2);
}

export function buildExposureBook(
  positions: ForexPublicPosition[],
  valuations: LivePositionValuation[]
): ExposureBook {
  const open = positions.filter((p) => p.status === 'OPEN' && dec(p.volume) > 0);
  const pnlById = new Map<string, LivePositionValuation>();
  for (const v of valuations) {
    const pos = open.find((p) => p.symbol === v.symbol && p.side === v.side);
    if (pos) pnlById.set(pos.positionId, v);
  }
  const bySymbol = new Map<
    string,
    { longVol: number; shortVol: number; longNot: number; shortNot: number; longPnl: number; shortPnl: number }
  >();
  let longNotional = 0;
  let shortNotional = 0;
  let longPnl = 0;
  let shortPnl = 0;
  for (const p of open) {
    const notional = dec(p.exposure);
    const vol = dec(p.volume);
    const live = pnlById.get(p.positionId);
    const pnl = live?.status === 'CALCULATED' && live.floating != null ? dec(live.floating) : 0;
    const row = bySymbol.get(p.symbol) ?? { longVol: 0, shortVol: 0, longNot: 0, shortNot: 0, longPnl: 0, shortPnl: 0 };
    if (p.side === 'long') {
      row.longVol += vol;
      row.longNot += notional;
      row.longPnl += pnl;
      longNotional += notional;
      longPnl += pnl;
    } else {
      row.shortVol += vol;
      row.shortNot += notional;
      row.shortPnl += pnl;
      shortNotional += notional;
      shortPnl += pnl;
    }
    bySymbol.set(p.symbol, row);
  }
  return {
    grossNotional: money(longNotional + shortNotional),
    netNotional: money(longNotional - shortNotional),
    longNotional: money(longNotional),
    shortNotional: money(shortNotional),
    longPnl: money(longPnl),
    shortPnl: money(shortPnl),
    bySymbol: Array.from(bySymbol.entries())
      .map(([symbol, r]) => ({
        symbol,
        longVolume: lots(r.longVol),
        shortVolume: lots(r.shortVol),
        netVolume: lots(r.longVol - r.shortVol),
        longNotional: money(r.longNot),
        shortNotional: money(r.shortNot),
        netNotional: money(r.longNot - r.shortNot),
        longPnl: money(r.longPnl),
        shortPnl: money(r.shortPnl),
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}

export interface CurrencyExposureRow {
  asset: string;
  /** Signed currency units. Long base is positive; the quote leg is the opposite sign. */
  volume: number;
  /** Units of account currency per 1 unit of this asset. Null when no direct quote exists. */
  rate: number | null;
  /** volume × rate. Null when the rate is unknown — never filled with a guessed cross. */
  value: number | null;
}

function quoteMid(q?: { bid?: string; ask?: string; mid?: string }): number | null {
  if (!q) return null;
  const mid = dec(q.mid);
  if (mid > 0) return mid;
  const bid = dec(q.bid);
  const ask = dec(q.ask);
  if (bid > 0 && ask > 0) return (bid + ask) / 2;
  if (bid > 0) return bid;
  if (ask > 0) return ask;
  return null;
}

function pairCurrencies(
  symbol: string,
  inst?: { baseCurrency?: string; quoteCurrency?: string }
): { base: string; quote: string } | null {
  const base = inst?.baseCurrency?.trim();
  const quote = inst?.quoteCurrency?.trim();
  if (base && quote) return { base: base.toUpperCase(), quote: quote.toUpperCase() };
  const compact = symbol.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (compact.length === 6) return { base: compact.slice(0, 3), quote: compact.slice(3) };
  return null;
}

function findQuote<T>(quotes: Record<string, T | undefined>, pair: string): T | undefined {
  if (quotes[pair]) return quotes[pair];
  const target = pair.toUpperCase();
  for (const [key, value] of Object.entries(quotes)) {
    if (key.toUpperCase() === target && value) return value;
  }
  return undefined;
}

/** Direct or inverse quote versus the account currency. No triangulated cross. */
export function rateToAccountCurrency(
  asset: string,
  accountCurrency: string,
  quotes: Record<string, { bid?: string; ask?: string; mid?: string } | undefined>
): number | null {
  const ccy = asset.toUpperCase();
  const account = accountCurrency.toUpperCase();
  if (!ccy || !account) return null;
  if (ccy === account) return 1;
  const direct = quoteMid(findQuote(quotes, `${ccy}${account}`));
  if (direct != null && direct > 0) return direct;
  const inverse = quoteMid(findQuote(quotes, `${account}${ccy}`));
  if (inverse != null && inverse > 0) return 1 / inverse;
  return null;
}

/**
 * MT4 Exposure rows: one line per currency, built from open positions.
 * A long EURUSD adds EUR units and subtracts USD units (lots × contract × price).
 */
export function buildCurrencyExposure(args: {
  positions: ForexPublicPosition[];
  instruments: Record<string, { baseCurrency?: string; quoteCurrency?: string; contractSize?: string } | undefined>;
  quotes: Record<string, { bid?: string; ask?: string; mid?: string } | undefined>;
  accountCurrency: string;
}): CurrencyExposureRow[] {
  const totals = new Map<string, number>();
  for (const position of args.positions) {
    if (position.status !== 'OPEN') continue;
    const lotsN = dec(position.volume);
    if (lotsN <= 0) continue;
    const pair = pairCurrencies(position.symbol, args.instruments[position.symbol]);
    if (!pair) continue;
    const contract = dec(position.contractSize || args.instruments[position.symbol]?.contractSize);
    if (contract <= 0) continue;
    const units = lotsN * contract;
    const sign = position.side === 'long' ? 1 : -1;
    const price = (() => {
      const current = dec(position.currentPrice);
      if (current > 0) return current;
      const entry = dec(position.entryPrice);
      if (entry > 0) return entry;
      return quoteMid(findQuote(args.quotes, position.symbol)) ?? 0;
    })();
    totals.set(pair.base, (totals.get(pair.base) ?? 0) + sign * units);
    if (price > 0) totals.set(pair.quote, (totals.get(pair.quote) ?? 0) - sign * units * price);
  }
  return Array.from(totals.entries())
    .filter(([, volume]) => Math.abs(volume) > 1e-8)
    .map(([asset, volume]) => {
      const rate = rateToAccountCurrency(asset, args.accountCurrency, args.quotes);
      return { asset, volume, rate, value: rate == null ? null : volume * rate };
    })
    .sort((a, b) => a.asset.localeCompare(b.asset));
}
