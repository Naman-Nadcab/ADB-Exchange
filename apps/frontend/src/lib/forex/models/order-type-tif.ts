/**
 * Order-type and Time-in-Force rules mirrored from the Phase A backend
 * (services/forex/orders/validate.ts). The UI must not offer a combination the
 * server is guaranteed to reject, and must not invent one it does not support.
 */
import {
  defaultForexTranslate,
  describeCustomerOrderLabel,
  labelForexOrderType,
  labelForexTimeInForce,
  orderKindHelpLabel,
  timeInForceBlockedReasonLabel,
  unavailableTicketFeatureLabels,
  FOREX_ORDER_TYPE_KEYS,
} from '../presentation/order-type-labels';
import type { ForexOrderType, ForexSide, ForexTimeInForce, ForexTradingConfig } from './types';

export const FOREX_ORDER_TYPE_LABEL: Record<ForexOrderType, string> = {
  market: labelForexOrderType(defaultForexTranslate, 'market'),
  limit: labelForexOrderType(defaultForexTranslate, 'limit'),
  stop: labelForexOrderType(defaultForexTranslate, 'stop'),
  stop_limit: labelForexOrderType(defaultForexTranslate, 'stop_limit'),
};

/** MT5-style label: Market Buy, Buy Limit, Sell Stop Limit, … */
export function describeCustomerOrder(side: ForexSide, orderType: ForexOrderType): string {
  return describeCustomerOrderLabel(defaultForexTranslate, side, orderType);
}

export function orderKindHelp(orderType: ForexOrderType, side: ForexSide): string {
  return orderKindHelpLabel(defaultForexTranslate, orderType, side);
}

export const FOREX_TIME_IN_FORCE_ALL: ForexTimeInForce[] = ['GTC', 'IOC', 'FOK', 'DAY', 'GTD'];

export const FOREX_TIME_IN_FORCE_LABEL: Record<ForexTimeInForce, string> = {
  GTC: labelForexTimeInForce(defaultForexTranslate, 'GTC'),
  IOC: labelForexTimeInForce(defaultForexTranslate, 'IOC'),
  FOK: labelForexTimeInForce(defaultForexTranslate, 'FOK'),
  DAY: labelForexTimeInForce(defaultForexTranslate, 'DAY'),
  GTD: labelForexTimeInForce(defaultForexTranslate, 'GTD'),
};

/** limit, stop and stop_limit rest on the book until a quote triggers them. */
export function isPendingOrderType(type: ForexOrderType): boolean {
  return type === 'limit' || type === 'stop' || type === 'stop_limit';
}

export function requiresLimitPrice(type: ForexOrderType): boolean {
  return type === 'stop_limit';
}

export function requiresTriggerPrice(type: ForexOrderType): boolean {
  return isPendingOrderType(type);
}

/** IOC/FOK need an immediate execution; DAY needs something that can rest. */
export function isTimeInForceAllowed(type: ForexOrderType, tif: ForexTimeInForce): boolean {
  if (tif === 'GTC') return true;
  if (tif === 'DAY' || tif === 'GTD') return isPendingOrderType(type);
  return !isPendingOrderType(type);
}

export function timeInForceBlockedReason(type: ForexOrderType, tif: ForexTimeInForce): string | null {
  return timeInForceBlockedReasonLabel(defaultForexTranslate, type, tif);
}

/**
 * TIF options the backend advertises, intersected with the ones this build
 * knows how to send. Falls back to GTC-only when the backend is silent, so a
 * pre-Phase-A server never sees a field it cannot parse.
 */
export function availableTimeInForce(config: ForexTradingConfig | null | undefined): ForexTimeInForce[] {
  const advertised = config?.timeInForce;
  if (!Array.isArray(advertised) || advertised.length === 0) return ['GTC'];
  const allowed = advertised.filter((t): t is ForexTimeInForce =>
    (FOREX_TIME_IN_FORCE_ALL as string[]).includes(String(t))
  );
  return allowed.length > 0 ? FOREX_TIME_IN_FORCE_ALL.filter((t) => allowed.includes(t)) : ['GTC'];
}

export function availableOrderTypes(config: ForexTradingConfig | null | undefined): ForexOrderType[] {
  const advertised = config?.orderTypes;
  if (!Array.isArray(advertised) || advertised.length === 0) return ['market', 'limit', 'stop'];
  const known = advertised.filter((t): t is ForexOrderType => t in FOREX_ORDER_TYPE_KEYS);
  return known.length > 0 ? known : ['market', 'limit', 'stop'];
}

/** Keeps a selected TIF legal after the order type changes. */
export function coerceTimeInForce(
  type: ForexOrderType,
  tif: ForexTimeInForce,
  available: ForexTimeInForce[]
): ForexTimeInForce {
  if (available.includes(tif) && isTimeInForceAllowed(type, tif)) return tif;
  return available.find((t) => isTimeInForceAllowed(type, t)) ?? 'GTC';
}

/**
 * Surfaces genuinely missing capability only. Anything the backend advertises
 * must not be labelled unavailable.
 */
export function unavailableTicketFeatures(config: ForexTradingConfig | null | undefined): string[] {
  return unavailableTicketFeatureLabels(defaultForexTranslate, config);
}
