/**
 * Authoritative Forex exposure. Decimal only. Never frontend prices.
 * Position.exposure is the notional from the Phase-5/6 margin snapshot.
 */
import { fxDecimal } from '../decimal-fx.js';
import type { ForexPositionRecord } from '../positions/models.js';

export interface ForexExposureSnapshot {
  positionNotionals: Record<string, string>;
  symbolExposure: Record<string, string>;
  symbolGross: Record<string, string>;
  symbolNet: Record<string, string>;
  accountGross: string;
  accountNet: string;
  totalForexGross: string;
  usedMargin: string;
  maintenanceMargin: string;
  openPositions: number;
}

export function calculateForexExposure(positions: ForexPositionRecord[]): ForexExposureSnapshot {
  const open = positions.filter((p) => p.status === 'OPEN' && fxDecimal(p.volume).gt(0));
  const positionNotionals: Record<string, string> = {};
  const symbolLong: Record<string, ReturnType<typeof fxDecimal>> = {};
  const symbolShort: Record<string, ReturnType<typeof fxDecimal>> = {};
  let gross = fxDecimal(0);
  let net = fxDecimal(0);
  for (const p of open) {
    const notional = fxDecimal(p.exposure);
    positionNotionals[p.positionId] = notional.toFixed();
    gross = gross.plus(notional);
    net = net.plus(p.side === 'long' ? notional : notional.neg());
    if (p.side === 'long') symbolLong[p.symbol] = (symbolLong[p.symbol] ?? fxDecimal(0)).plus(notional);
    else symbolShort[p.symbol] = (symbolShort[p.symbol] ?? fxDecimal(0)).plus(notional);
  }
  const charged = hedgedMarginCharge(open);
  const used = charged.used;
  const maint = charged.maintenance;
  const symbols = new Set([...Object.keys(symbolLong), ...Object.keys(symbolShort)]);
  const symbolExposure: Record<string, string> = {};
  const symbolGross: Record<string, string> = {};
  const symbolNet: Record<string, string> = {};
  for (const s of symbols) {
    const lg = symbolLong[s] ?? fxDecimal(0);
    const sh = symbolShort[s] ?? fxDecimal(0);
    symbolGross[s] = lg.plus(sh).toFixed();
    symbolNet[s] = lg.minus(sh).toFixed();
    symbolExposure[s] = lg.plus(sh).toFixed();
  }
  return {
    positionNotionals,
    symbolExposure,
    symbolGross,
    symbolNet,
    accountGross: gross.toFixed(),
    accountNet: net.toFixed(),
    totalForexGross: gross.toFixed(),
    usedMargin: used.toFixed(),
    maintenanceMargin: maint.toFixed(),
    openPositions: open.length,
  };
}

/**
 * Hedging margin: locked volume is free.
 * Equal buy and sell lots on one symbol charge 0. Only the unmatched lots
 * on the larger side keep their margin. A one-sided book is unchanged.
 */
export function hedgedMarginCharge(positions: ForexPositionRecord[]): { used: ReturnType<typeof fxDecimal>; maintenance: ReturnType<typeof fxDecimal> } {
  type Side = { volume: ReturnType<typeof fxDecimal>; margin: ReturnType<typeof fxDecimal>; maintenance: ReturnType<typeof fxDecimal> };
  const books = new Map<string, { long: Side; short: Side }>();
  const empty = (): Side => ({ volume: fxDecimal(0), margin: fxDecimal(0), maintenance: fxDecimal(0) });
  for (const p of positions) {
    if (p.status !== 'OPEN' || !fxDecimal(p.volume).gt(0)) continue;
    const book = books.get(p.symbol) ?? { long: empty(), short: empty() };
    const side = p.side === 'long' ? book.long : book.short;
    side.volume = side.volume.plus(p.volume);
    side.margin = side.margin.plus(p.initialMargin);
    side.maintenance = side.maintenance.plus(p.maintenanceMargin);
    books.set(p.symbol, book);
  }
  let used = fxDecimal(0);
  let maintenance = fxDecimal(0);
  for (const book of books.values()) {
    const longIsLarger = !book.short.volume.gt(book.long.volume);
    const larger = longIsLarger ? book.long : book.short;
    const smallerVol = longIsLarger ? book.short.volume : book.long.volume;
    if (!larger.volume.gt(0)) continue;
    const uncovered = larger.volume.minus(smallerVol);
    if (!uncovered.gt(0)) continue;
    const ratio = uncovered.div(larger.volume);
    used = used.plus(larger.margin.times(ratio));
    maintenance = maintenance.plus(larger.maintenance.times(ratio));
  }
  return { used, maintenance };
}

export function aggregateForexGross(allOpen: ForexPositionRecord[]): string {
  return calculateForexExposure(allOpen).accountGross;
}
