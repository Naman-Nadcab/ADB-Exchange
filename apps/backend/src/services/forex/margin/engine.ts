import {
  effectiveMarginCallLevel,
  effectiveMarginWarningLevel,
  effectiveStopOutLevel,
} from '../admin/effective-config.js';
import { forexConfig } from '../config.js';
import { fxDecimal } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import {
  FOREX_ACCOUNTING_CURRENCY,
  MapConversionSource,
  convertQuoteToAccount,
  type ConversionRateSource,
} from '../pnl/conversion.js';
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

/**
 * Notional in the ACCOUNT currency (USD).
 *
 * `volume × contractSize × price` is denominated in the instrument's QUOTE
 * currency (JPY for USDJPY/EURJPY, CHF for USDCHF, ...). Margin, exposure and
 * free-margin are all USD, so the quote-currency notional must be converted
 * with the same rules as realized/unrealized P&L (pnl/conversion.ts):
 *   - quote is USD           → identity
 *   - instrument is a USD pair → its own price (USDJPY: notional = volume × contractSize)
 *   - cross (EURJPY, GBPJPY)  → USDJPY / XXXUSD rate from `rates`, fail closed if unavailable
 */
export function notionalValueInAccountCurrency(args: {
  symbol: string;
  volume: string;
  contractSize: string;
  price: string;
  rates?: ConversionRateSource;
}): string {
  const quoteNotional = notionalValue(args.volume, args.contractSize, args.price);
  if (!fxDecimal(quoteNotional).gt(0)) return '0';
  const instrument = getForexInstrumentBySymbol(args.symbol);
  if (!instrument || instrument.quoteCurrency === FOREX_ACCOUNTING_CURRENCY) return quoteNotional;
  return convertQuoteToAccount({
    quoteAmount: quoteNotional,
    instrumentSymbol: args.symbol,
    rates: args.rates ?? EMPTY_RATES,
    ownRate: args.price,
    ownPriceSource: 'OWN_FILL',
  }).amountAccount;
}

const EMPTY_RATES = new MapConversionSource();

export function positionMarginSnapshot(args: {
  symbol: string;
  volume: string;
  entryPrice: string;
  currentPrice: string;
  accountMaxLeverage?: string;
  /** Conversion rates for cross pairs whose quote currency is not USD. */
  rates?: ConversionRateSource;
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
  const entryNotional = notionalValueInAccountCurrency({
    symbol: args.symbol,
    volume: args.volume,
    contractSize,
    price: args.entryPrice,
    rates: args.rates,
  });
  const currentNotional = notionalValueInAccountCurrency({
    symbol: args.symbol,
    volume: args.volume,
    contractSize,
    price: args.currentPrice,
    rates: args.rates,
  });
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
  const stop = fxDecimal(effectiveStopOutLevel());
  const call = fxDecimal(effectiveMarginCallLevel());
  const warn = fxDecimal(effectiveMarginWarningLevel());
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
