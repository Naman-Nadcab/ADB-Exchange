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
  let used = fxDecimal(0);
  let maint = fxDecimal(0);
  for (const p of open) {
    const notional = fxDecimal(p.exposure);
    positionNotionals[p.positionId] = notional.toFixed();
    used = used.plus(p.initialMargin);
    maint = maint.plus(p.maintenanceMargin);
    gross = gross.plus(notional);
    net = net.plus(p.side === 'long' ? notional : notional.neg());
    if (p.side === 'long') symbolLong[p.symbol] = (symbolLong[p.symbol] ?? fxDecimal(0)).plus(notional);
    else symbolShort[p.symbol] = (symbolShort[p.symbol] ?? fxDecimal(0)).plus(notional);
  }
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

export function aggregateForexGross(allOpen: ForexPositionRecord[]): string {
  return calculateForexExposure(allOpen).accountGross;
}
