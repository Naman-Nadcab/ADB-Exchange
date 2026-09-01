import { FOREX_INSTRUMENT_CATALOG } from './instruments.catalog.js';
import { buildDefaultForexSessionCalendar } from './sessions.catalog.js';
import type { ForexInstrument, ForexSessionCalendar } from './types.js';

export function listForexInstruments(): ForexInstrument[] {
  return FOREX_INSTRUMENT_CATALOG.map((i) => ({ ...i }));
}

export function getForexSessionCalendar(): ForexSessionCalendar {
  return buildDefaultForexSessionCalendar();
}

export function instrumentToApi(i: ForexInstrument) {
  return {
    id: i.id,
    symbol: i.symbol,
    displaySymbol: i.displaySymbol,
    baseCurrency: i.baseCurrency,
    quoteCurrency: i.quoteCurrency,
    assetClass: i.assetClass,
    digits: i.digits,
    pricePrecision: i.pricePrecision,
    pipSize: i.pipSize,
    tickSize: i.tickSize,
    contractSize: i.contractSize,
    minVolume: i.minVolume,
    maxVolume: i.maxVolume,
    volumeStep: i.volumeStep,
    tradingStatus: i.tradingStatus,
    sessionCalendarId: i.sessionCalendarId,
    maxLeverage: i.maxLeverage,
    marginPercent: i.marginPercent,
    commission: i.commission,
    commissionType: i.commissionType,
    swapLong: i.swapLong,
    swapShort: i.swapShort,
    swap3day: i.swap3day,
  };
}
