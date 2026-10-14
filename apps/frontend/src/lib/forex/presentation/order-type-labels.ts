import enForex from '../../../../messages/en/forex.json';
import type { ForexOrderType, ForexSide, ForexTimeInForce, ForexTradingConfig } from '../models/types';
import {
  availableOrderTypes,
  availableTimeInForce,
  isPendingOrderType,
  isTimeInForceAllowed,
} from '../models/order-type-tif';

export type ForexTranslate = (key: string, values?: Record<string, string | number | boolean>) => string;

function resolveEn(key: string, values?: Record<string, string | number | boolean>): string {
  const parts = key.split('.');
  let cur: unknown = enForex;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return key;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur !== 'string') return key;
  return cur.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? `{${k}}`));
}

/** English catalog resolver — keeps order-type-tif tests and phase-a UI tests stable. */
export const defaultForexTranslate: ForexTranslate = resolveEn;

const ORDER_TYPE_I18N: Record<ForexOrderType, string> = {
  market: 'orderTypes.MARKET',
  limit: 'orderTypes.LIMIT',
  stop: 'orderTypes.STOP',
  stop_limit: 'orderTypes.STOP_LIMIT',
};

export function labelForexOrderType(tf: ForexTranslate, type: ForexOrderType): string {
  return tf(ORDER_TYPE_I18N[type]);
}

export function describeCustomerOrderLabel(tf: ForexTranslate, side: ForexSide, orderType: ForexOrderType): string {
  if (orderType === 'market') {
    return side === 'buy' ? tf('customerOrder.marketBuy') : tf('customerOrder.marketSell');
  }
  const key =
    orderType === 'limit'
      ? side === 'buy'
        ? 'customerOrder.buyLimit'
        : 'customerOrder.sellLimit'
      : orderType === 'stop'
        ? side === 'buy'
          ? 'customerOrder.buyStop'
          : 'customerOrder.sellStop'
        : side === 'buy'
          ? 'customerOrder.buyStopLimit'
          : 'customerOrder.sellStopLimit';
  return tf(key);
}

export function orderKindHelpLabel(tf: ForexTranslate, orderType: ForexOrderType, side: ForexSide): string {
  if (orderType === 'market') return tf('orderKindHelp.market');
  if (orderType === 'limit') {
    return side === 'buy' ? tf('orderKindHelp.limitBuy') : tf('orderKindHelp.limitSell');
  }
  if (orderType === 'stop') {
    return side === 'buy' ? tf('orderKindHelp.stopBuy') : tf('orderKindHelp.stopSell');
  }
  return side === 'buy' ? tf('orderKindHelp.stopLimitBuy') : tf('orderKindHelp.stopLimitSell');
}

export function labelForexTimeInForce(tf: ForexTranslate, tif: ForexTimeInForce): string {
  return tf(`tifLabels.${tif}`);
}

export function timeInForceBlockedReasonLabel(
  tf: ForexTranslate,
  type: ForexOrderType,
  tif: ForexTimeInForce
): string | null {
  if (isTimeInForceAllowed(type, tif)) return null;
  if (tif === 'DAY' || tif === 'GTD' || tif === 'BOC') return tf('tifBlocked.pendingOnly', { tif });
  return tf('tifBlocked.immediateOnly', { tif });
}

export function unavailableTicketFeatureLabels(
  tf: ForexTranslate,
  config: ForexTradingConfig | null | undefined
): string[] {
  const out: string[] = [];
  if (!availableOrderTypes(config).includes('stop_limit')) out.push(tf('ticketUnavailable.stopLimit'));
  if (availableTimeInForce(config).length <= 1) out.push(tf('ticketUnavailable.tif'));
  return out;
}

/** Keys for `type in FOREX_ORDER_TYPE_LABEL` checks in order-type-tif. */
export const FOREX_ORDER_TYPE_KEYS: Record<ForexOrderType, true> = {
  market: true,
  limit: true,
  stop: true,
  stop_limit: true,
};
