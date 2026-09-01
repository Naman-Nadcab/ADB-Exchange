import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import { resolveEffectiveLeverage } from './leverage.js';

export type ForexMarginStatus = 'NORMAL' | 'WARNING' | 'MARGIN_CALL' | 'STOP_OUT_READY';

/**
 * Valuation prices (backend-authoritative, never frontend):
 * - initial / used margin: weighted average entry (sum of open initial margins)
 * - current exposure / currentMargin: executable close (LONG=BID, SHORT=ASK)
 * - mid is never used for liquidation-critical equity
 *
 * Required margin is the STRICTER of:
 *   notional / effectiveLeverage
 *   notional * (instrument.marginPercent / 100)
 */
export function notionalValue(volume: string, contractSize: string, price: string): string {
  return fxDecimal(volume).times(contractSize).times(price).toFixed();
}

export function requiredMargin(notional: string, leverage: string, marginPercent: string): string {
  const n = fxDecimal(notional);
  const byLev = n.div(fxDecimal(leverage).gt(0) ? leverage : '1');
  const pct = fxDecimal(marginPercent);
  const byPct = pct.gt(0) ? n.times(pct).div(100) : byLev;
  return (byLev.gt(byPct) ? byLev : byPct).toFixed();
}

export function maintenanceFromInitial(initialMargin: string, ratio = forexConfig.maintenanceRatio): string {
  return fxDecimal(initialMargin).times(ratio).toFixed();
}

export function positionMarginSnapshot(args: {
  symbol: string;
  volume: string;
  entryPrice: string;
  currentPrice: string;
  accountMaxLeverage?: string;
}): {
  contractSize: string;
  leverage: string;
  initialMargin: string;
  maintenanceMargin: string;
  currentMargin: string;
  exposure: string;
} {
  const instrument = getForexInstrumentBySymbol(args.symbol);
  const contractSize = instrument?.contractSize ?? '100000';
  const leverage = resolveEffectiveLeverage(args.symbol, args.accountMaxLeverage);
  const percent = instrument?.marginPercent ?? '0';
  const entryNotional = notionalValue(args.volume, contractSize, args.entryPrice);
  const currentNotional = notionalValue(args.volume, contractSize, args.currentPrice);
  const initialMargin = requiredMargin(entryNotional, leverage, percent);
  return {
    contractSize,
    leverage,
    initialMargin,
    maintenanceMargin: maintenanceFromInitial(initialMargin),
    currentMargin: requiredMargin(currentNotional, leverage, percent),
    exposure: currentNotional,
  };
}

export function classifyMarginLevel(marginLevel: string | null): ForexMarginStatus {
  if (marginLevel == null) return 'NORMAL';
  const lvl = fxDecimal(marginLevel);
  const stop = fxDecimal(forexConfig.stopOutLevel);
  const call = fxDecimal(forexConfig.marginCallLevel);
  const warn = fxDecimal(forexConfig.marginWarningLevel);
  if (lvl.lte(stop)) return 'STOP_OUT_READY';
  if (lvl.lte(call)) return 'MARGIN_CALL';
  if (lvl.lte(warn)) return 'WARNING';
  return 'NORMAL';
}

export function marginLevel(equity: string, usedMargin: string): string | null {
  const used = fxDecimal(usedMargin);
  if (!used.gt(0)) return null;
  return fxDecimal(equity).div(used).times(100).toFixed();
}
