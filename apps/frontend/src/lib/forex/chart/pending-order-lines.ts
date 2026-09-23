import type { ForexPublicOrder } from '../models/types';

export const FOREX_CHART_PENDING_STATUSES = new Set([
  'NEW',
  'PARTIAL',
  'OPEN',
  'WORKING',
  'ACCEPTED',
  'PENDING',
  'TRIGGERING',
  'VALIDATING',
]);

export type ForexDraggablePendingLine = {
  key: string;
  orderId: string;
  field: 'requestedPrice' | 'limitPrice';
  price: number;
  title: string;
};

/** Draggable pending price lines for the active chart symbol (server modify on commit). */
export function buildDraggablePendingLines(
  orders: Record<string, ForexPublicOrder>,
  symbol: string
): ForexDraggablePendingLine[] {
  const out: ForexDraggablePendingLine[] = [];
  for (const o of Object.values(orders)) {
    if (o.symbol !== symbol) continue;
    if (!FOREX_CHART_PENDING_STATUSES.has(String(o.status ?? '').toUpperCase())) continue;
    if (o.type === 'market') continue;

    const side = o.side.toUpperCase();
    const rp = Number(o.requestedPrice);
    if (Number.isFinite(rp) && rp > 0) {
      const label =
        o.type === 'stop_limit'
          ? `${side} STOP`
          : o.type === 'stop'
            ? `${side} STOP`
            : `${side} LIMIT`;
      out.push({
        key: `${o.orderId}:requestedPrice`,
        orderId: o.orderId,
        field: 'requestedPrice',
        price: rp,
        title: label,
      });
    }

    if (o.type === 'stop_limit') {
      const lp = Number(o.limitPrice);
      if (Number.isFinite(lp) && lp > 0) {
        out.push({
          key: `${o.orderId}:limitPrice`,
          orderId: o.orderId,
          field: 'limitPrice',
          price: lp,
          title: `${side} LIMIT (working)`,
        });
      }
    }
  }
  return out;
}
