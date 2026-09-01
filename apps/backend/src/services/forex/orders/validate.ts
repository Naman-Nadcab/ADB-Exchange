import { fxDecimal, fxDecimalPlaces, fxPositive } from '../decimal-fx.js';
import { getForexInstrumentBySymbol, normalizeForexSymbol } from '../instruments.catalog.js';
import type { ForexOrderRequest } from './request.js';
import type { ForexOrderReason } from './states.js';

export interface OrderValidationOk {
  ok: true;
  symbol: string;
}

export interface OrderValidationFail {
  ok: false;
  reason: ForexOrderReason;
  detail: string;
}

export function validateForexOrderRequest(req: ForexOrderRequest): OrderValidationOk | OrderValidationFail {
  const clientOrderId = req.clientOrderId?.trim() ?? '';
  if (!clientOrderId || clientOrderId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(clientOrderId)) {
    return { ok: false, reason: 'INVALID_CLIENT_ORDER_ID', detail: 'clientOrderId is required and must be 1-128 safe characters' };
  }

  if (req.orderType !== 'market') {
    return { ok: false, reason: 'UNSUPPORTED_ORDER_TYPE', detail: `orderType ${req.orderType} is not supported in Phase 4` };
  }

  if (req.side !== 'buy' && req.side !== 'sell') {
    return { ok: false, reason: 'INVALID_SIDE', detail: `side ${String(req.side)} is invalid` };
  }

  const symbol = normalizeForexSymbol(req.symbol);
  const instrument = getForexInstrumentBySymbol(symbol);
  if (!instrument) {
    return { ok: false, reason: 'UNKNOWN_INSTRUMENT', detail: `Unknown Forex symbol ${symbol}` };
  }
  if (instrument.tradingStatus !== 'active') {
    return { ok: false, reason: 'INSTRUMENT_HALTED', detail: `${symbol} is ${instrument.tradingStatus}` };
  }

  let volume;
  try {
    volume = fxDecimal(req.volume);
  } catch {
    return { ok: false, reason: 'INVALID_VOLUME', detail: 'volume is not a decimal' };
  }
  if (!volume.isFinite() || !fxPositive(volume)) {
    return { ok: false, reason: 'INVALID_VOLUME', detail: 'volume must be > 0' };
  }
  if (fxDecimalPlaces(volume) > 8) {
    return { ok: false, reason: 'INVALID_VOLUME_PRECISION', detail: 'volume precision exceeds 8 decimals' };
  }
  const step = fxDecimal(instrument.volumeStep);
  const min = fxDecimal(instrument.minVolume);
  const max = fxDecimal(instrument.maxVolume);
  if (volume.lt(min) || volume.gt(max)) {
    return { ok: false, reason: 'INVALID_VOLUME_STEP', detail: `volume outside ${instrument.minVolume}-${instrument.maxVolume}` };
  }
  if (!volume.div(step).isInteger()) {
    return { ok: false, reason: 'INVALID_VOLUME_STEP', detail: `volume must be a multiple of ${instrument.volumeStep}` };
  }

  if (req.requestedPrice != null && req.requestedPrice !== '') {
    try {
      const px = fxDecimal(req.requestedPrice);
      if (!px.isFinite() || !fxPositive(px)) {
        return { ok: false, reason: 'INVALID_PRICE', detail: 'requestedPrice must be > 0' };
      }
      if (fxDecimalPlaces(px) > instrument.pricePrecision) {
        return { ok: false, reason: 'INVALID_PRICE', detail: `price exceeds ${instrument.pricePrecision} decimals` };
      }
    } catch {
      return { ok: false, reason: 'INVALID_PRICE', detail: 'requestedPrice is not a decimal' };
    }
  }

  if (req.maxSlippage != null && req.maxSlippage !== '') {
    try {
      const s = fxDecimal(req.maxSlippage);
      if (!s.isFinite() || s.lt(0)) {
        return { ok: false, reason: 'INVALID_SLIPPAGE', detail: 'maxSlippage must be a non-negative decimal' };
      }
    } catch {
      return { ok: false, reason: 'INVALID_SLIPPAGE', detail: 'maxSlippage is not a decimal' };
    }
  }

  if (req.maxDeviation != null && req.maxDeviation !== '') {
    try {
      const d = fxDecimal(req.maxDeviation);
      if (!d.isFinite() || d.lt(0)) {
        return { ok: false, reason: 'INVALID_DEVIATION', detail: 'maxDeviation must be a non-negative decimal' };
      }
    } catch {
      return { ok: false, reason: 'INVALID_DEVIATION', detail: 'maxDeviation is not a decimal' };
    }
  }

  return { ok: true, symbol };
}
