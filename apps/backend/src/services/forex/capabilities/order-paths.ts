import type { ForexCustomerOrderType } from '../orders/request.js';

/** Canonical customer order model: SIDE × KIND (8 derived paths). */
export const FOREX_ORDER_KINDS = ['market', 'limit', 'stop', 'stop_limit'] as const satisfies readonly ForexCustomerOrderType[];
export const FOREX_ORDER_SIDES = ['buy', 'sell'] as const;

export type ForexOrderKind = (typeof FOREX_ORDER_KINDS)[number];
export type ForexOrderSide = (typeof FOREX_ORDER_SIDES)[number];

export type ForexCustomerOrderPath = {
  side: ForexOrderSide;
  kind: ForexOrderKind;
  label: string;
};

const LABEL: Record<ForexOrderSide, Record<ForexOrderKind, string>> = {
  buy: {
    market: 'Market Buy',
    limit: 'Buy Limit',
    stop: 'Buy Stop',
    stop_limit: 'Buy Stop Limit',
  },
  sell: {
    market: 'Market Sell',
    limit: 'Sell Limit',
    stop: 'Sell Stop',
    stop_limit: 'Sell Stop Limit',
  },
};

export function listForexCustomerOrderPaths(): ForexCustomerOrderPath[] {
  const out: ForexCustomerOrderPath[] = [];
  for (const side of FOREX_ORDER_SIDES) {
    for (const kind of FOREX_ORDER_KINDS) {
      out.push({ side, kind, label: LABEL[side][kind] });
    }
  }
  return out;
}

export function forexOrderPathLabel(side: ForexOrderSide, kind: ForexOrderKind): string {
  return LABEL[side][kind];
}
