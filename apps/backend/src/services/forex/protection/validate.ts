import { fxDecimal, fxDecimalPlaces, fxPositive } from '../decimal-fx.js';
import { getForexInstrumentBySymbol } from '../instruments.catalog.js';
import type { ForexPositionRecord } from '../positions/models.js';
import type { ForexQuoteDto } from '../types.js';
import { ForexProtectionError } from './models.js';
import type { ForexProtectionType } from './states.js';
import { executableTriggerPrice, quoteUsableForTrigger, triggerDirectionValid } from './trigger.js';

export function validateProtectionCreate(args: {
  clientProtectionId: string;
  type: string;
  triggerPrice: string;
  volume: string;
  position: ForexPositionRecord;
  quote: ForexQuoteDto | undefined;
}): { type: ForexProtectionType; volume: string; triggerPrice: string; symbol: string } {
  const client = args.clientProtectionId.trim();
  if (!client || client.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(client)) {
    throw new ForexProtectionError('INVALID_CLIENT_PROTECTION_ID', 'clientProtectionId is required and must be 1-128 safe characters');
  }
  if (args.type !== 'STOP_LOSS' && args.type !== 'TAKE_PROFIT') {
    throw new ForexProtectionError('INVALID_PROTECTION_TYPE', 'type must be STOP_LOSS or TAKE_PROFIT');
  }
  if (args.position.status !== 'OPEN' || !fxDecimal(args.position.volume).gt(0)) {
    throw new ForexProtectionError('POSITION_NOT_OPEN', 'protection requires an open position', 409);
  }
  const instrument = getForexInstrumentBySymbol(args.position.symbol);
  if (!instrument || instrument.tradingStatus !== 'active') {
    throw new ForexProtectionError('UNKNOWN_INSTRUMENT', args.position.symbol);
  }
  if (!quoteUsableForTrigger(args.quote)) {
    throw new ForexProtectionError('PRICE_UNAVAILABLE', 'authoritative quote is unavailable or stale', 409);
  }
  let trigger;
  try {
    trigger = fxDecimal(args.triggerPrice);
  } catch {
    throw new ForexProtectionError('INVALID_TRIGGER_PRICE', 'triggerPrice is not a decimal');
  }
  if (!trigger.isFinite() || !fxPositive(trigger)) {
    throw new ForexProtectionError('INVALID_TRIGGER_PRICE', 'triggerPrice must be > 0');
  }
  if (fxDecimalPlaces(trigger) > instrument.pricePrecision) {
    throw new ForexProtectionError('INVALID_TRIGGER_PRECISION', `trigger exceeds ${instrument.pricePrecision} decimals`);
  }
  const tick = fxDecimal(instrument.tickSize);
  if (!trigger.div(tick).isInteger()) {
    throw new ForexProtectionError('INVALID_TRIGGER_PRECISION', `trigger must align to tick ${instrument.tickSize}`);
  }
  let volume;
  try {
    volume = fxDecimal(args.volume);
  } catch {
    throw new ForexProtectionError('INVALID_VOLUME', 'volume is not a decimal');
  }
  if (!volume.isFinite() || !fxPositive(volume)) {
    throw new ForexProtectionError('INVALID_VOLUME', 'volume must be > 0');
  }
  if (volume.gt(args.position.volume)) {
    throw new ForexProtectionError('INVALID_VOLUME', 'volume exceeds open position');
  }
  const step = fxDecimal(instrument.volumeStep);
  if (volume.lt(instrument.minVolume) || volume.gt(instrument.maxVolume) || !volume.div(step).isInteger()) {
    throw new ForexProtectionError('INVALID_VOLUME_STEP', `volume must be a ${instrument.volumeStep} step within instrument limits`);
  }
  const market = executableTriggerPrice(args.position.side, args.quote);
  const dir = triggerDirectionValid({
    type: args.type,
    positionSide: args.position.side,
    triggerPrice: trigger.toFixed(),
    marketPrice: market,
  });
  if (!dir.ok) {
    throw new ForexProtectionError(dir.reason, 'trigger price is not valid for this side/type — not rewritten');
  }
  return {
    type: args.type,
    volume: volume.toFixed(),
    triggerPrice: trigger.toFixed(),
    symbol: args.position.symbol,
  };
}
