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
