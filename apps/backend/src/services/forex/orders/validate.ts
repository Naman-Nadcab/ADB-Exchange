import { fxDecimal, fxDecimalPlaces, fxPositive } from '../decimal-fx.js';
import { getForexInstrumentBySymbol, normalizeForexSymbol } from '../instruments.catalog.js';
import { isForexDemoMockSessionBypassActive } from '../sessions/demo-bypass.js';
import { isForexTradingEligible } from '../sessions/eligibility.js';
import { isForexPendingOrderType, pendingTriggerValid } from './pending.js';
import { normalizeForexTimeInForce, orderTimeInForce, type ForexOrderRequest } from './request.js';
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

function triggerDetail(req: ForexOrderRequest, reason: string): string {
  if (reason === 'INVALID_LIMIT_PRICE') return 'stop_limit requires a valid limitPrice';
  if (reason === 'INVALID_TRIGGER_RELATIONSHIP' && req.orderType === 'stop_limit') {
    return req.side === 'buy'
      ? 'buy stop_limit requires limitPrice <= stop price'
      : 'sell stop_limit requires limitPrice >= stop price';
  }
  if (reason === 'INVALID_TRIGGER_RELATIONSHIP') return `side ${String(req.side)} is invalid`;
  return 'pending order requires a valid requestedPrice';
}

export function validateForexOrderRequest(req: ForexOrderRequest): OrderValidationOk | OrderValidationFail {
  const clientOrderId = req.clientOrderId?.trim() ?? '';
  if (!clientOrderId || clientOrderId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(clientOrderId)) {
    return { ok: false, reason: 'INVALID_CLIENT_ORDER_ID', detail: 'clientOrderId is required and must be 1-128 safe characters' };
  }

  if (req.orderType !== 'market' && !isForexPendingOrderType(req.orderType)) {
    return { ok: false, reason: 'UNSUPPORTED_ORDER_TYPE', detail: `orderType ${String(req.orderType)} is not supported` };
  }

  if (normalizeForexTimeInForce(req.timeInForce) == null) {
    return { ok: false, reason: 'INVALID_TIME_IN_FORCE', detail: `timeInForce ${String(req.timeInForce)} is not supported` };
  }
  const tif = orderTimeInForce(req);
  if ((tif === 'IOC' || tif === 'FOK') && isForexPendingOrderType(req.orderType)) {
    return {
      ok: false,
      reason: 'UNSUPPORTED_TIME_IN_FORCE',
      detail: `timeInForce ${tif} is market-only and cannot be used with ${req.orderType} orders`,
    };
  }
  if (tif === 'DAY' && req.orderType === 'market') {
    return {
      ok: false,
      reason: 'UNSUPPORTED_TIME_IN_FORCE',
      detail: 'timeInForce DAY applies to pending orders only',
    };
  }
  if (tif === 'GTD') {
    if (req.orderType === 'market') {
      return {
        ok: false,
        reason: 'UNSUPPORTED_TIME_IN_FORCE',
        detail: 'timeInForce GTD applies to pending orders only',
      };
    }
    const raw = req.expireAt?.trim() ?? '';
    if (!raw) {
      return { ok: false, reason: 'INVALID_EXPIRE_AT', detail: 'GTD orders require expireAt (UTC ISO-8601)' };
    }
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) {
      return { ok: false, reason: 'INVALID_EXPIRE_AT', detail: 'expireAt must be a valid ISO-8601 timestamp' };
    }
    if (ms <= Date.now()) {
      return { ok: false, reason: 'INVALID_EXPIRE_AT', detail: 'expireAt must be in the future' };
    }
  } else if (req.expireAt != null && String(req.expireAt).trim() !== '') {
    return { ok: false, reason: 'INVALID_EXPIRE_AT', detail: 'expireAt is only valid with timeInForce GTD' };
  }

  const trigger = pendingTriggerValid({
    orderType: req.orderType,
    side: req.side,
    requestedPrice: req.requestedPrice,
    limitPrice: req.limitPrice,
  });
  if (!trigger.ok) {
    return { ok: false, reason: trigger.reason, detail: triggerDetail(req, trigger.reason) };
  }

  const session = isForexTradingEligible();
  const demoBypass = isForexDemoMockSessionBypassActive();
  if (!session.open && (req.intent ?? 'CUSTOMER') === 'CUSTOMER' && !demoBypass) {
    const reason = session.reason === 'HOLIDAY_UNCONFIGURED' ? 'HOLIDAY_UNCONFIGURED' : 'SESSION_CLOSED';
    return { ok: false, reason, detail: session.reason };
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

  if (req.limitPrice != null && req.limitPrice !== '') {
    try {
      const px = fxDecimal(req.limitPrice);
      if (!px.isFinite() || !fxPositive(px)) {
        return { ok: false, reason: 'INVALID_LIMIT_PRICE', detail: 'limitPrice must be > 0' };
      }
      if (fxDecimalPlaces(px) > instrument.pricePrecision) {
        return { ok: false, reason: 'INVALID_LIMIT_PRICE', detail: `limitPrice exceeds ${instrument.pricePrecision} decimals` };
      }
    } catch {
      return { ok: false, reason: 'INVALID_LIMIT_PRICE', detail: 'limitPrice is not a decimal' };
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
