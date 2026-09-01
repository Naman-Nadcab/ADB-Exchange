import { fxDecimal, fxDecimalPlaces, fxPositive } from '../decimal-fx.js';
import { getForexInstrumentBySymbol, normalizeForexSymbol } from '../instruments.catalog.js';
import type { ForexExecutionRequest } from './request.js';
import type { ForexExecReason } from './states.js';

export interface PretradeFailure {
  ok: false;
  reason: ForexExecReason;
  detail: string;
}

export interface PretradeSuccess {
  ok: true;
  symbol: string;
}

export function validateExecutionRequest(req: ForexExecutionRequest): PretradeSuccess | PretradeFailure {
  const clientExecId = req.clientExecId?.trim() ?? '';
  if (!clientExecId || clientExecId.length > 128) {
    return { ok: false, reason: 'INVALID_CLIENT_EXEC_ID', detail: 'clientExecId is required' };
  }

  const ts = Date.parse(req.timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'INVALID_TIMESTAMP', detail: 'timestamp is invalid' };
  }
  if (Math.abs(Date.now() - ts) > 60_000) {
    return { ok: false, reason: 'INVALID_TIMESTAMP', detail: 'timestamp is outside the allowed window' };
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
  const steps = volume.div(step);
  if (!steps.isInteger()) {
    return { ok: false, reason: 'INVALID_VOLUME_STEP', detail: `volume must be a multiple of ${instrument.volumeStep}` };
  }

  if (req.orderType === 'limit' || req.requestedPrice != null) {
    try {
      const px = fxDecimal(req.requestedPrice ?? '');
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

  return { ok: true, symbol };
}
