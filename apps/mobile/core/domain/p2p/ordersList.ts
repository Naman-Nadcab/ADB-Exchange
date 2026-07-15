/** P2P orders list — display helpers mirroring website p2p-v2/orders page. */

import type { P2POrder } from '@exchange/mobile-types';
import { formatFiatSymbol, formatP2pCryptoQty, formatP2pFiatPrice, parseNum } from './marketplace';

export const ORDER_STATUS_FILTERS = [
  '',
  'payment_pending',
  'payment_confirmed',
  'completed',
  'cancelled',
  'expired',
  'disputed',
] as const;

export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];

export const ORDER_FILTER_LABEL: Record<string, string> = {
  '': 'All',
  payment_pending: 'Pending',
  payment_confirmed: 'Confirmed',
  completed: 'Done',
  cancelled: 'Cancelled',
  expired: 'Expired',
  disputed: 'Dispute',
};

export const ORDER_STATUS_CHIP_LABEL: Record<string, string> = {
  payment_pending: 'Paying',
  payment_confirmed: 'Confirm',
  completed: 'Done',
  cancelled: 'Off',
  expired: 'Expired',
  disputed: 'Dispute',
};

export const IN_PROGRESS_ORDER_STATUSES = new Set(['payment_pending', 'payment_confirmed', 'disputed']);
export const TIME_SENSITIVE_ORDER_STATUSES = new Set(['payment_pending', 'payment_confirmed', 'disputed']);

export type OrderListStats = {
  total: number;
  inProgress: number;
  completed: number;
};

export type OrderSide = 'Buy' | 'Sell' | null;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function sortOrdersByCreatedDesc(orders: P2POrder[]): P2POrder[] {
  return [...orders].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

export function computeOrderListStats(orders: P2POrder[]): OrderListStats {
  let inProgress = 0;
  let completed = 0;
  for (const o of orders) {
    if (IN_PROGRESS_ORDER_STATUSES.has(o.status)) inProgress += 1;
    else if (o.status === 'completed') completed += 1;
  }
  return { total: orders.length, inProgress, completed };
}

export function orderSide(order: P2POrder, userId?: string | null): OrderSide {
  if (!userId) return null;
  if (order.buyer_id === userId) return 'Buy';
  if (order.seller_id === userId) return 'Sell';
  return null;
}

export function counterpartyLabel(order: P2POrder, userId?: string | null): string {
  if (!userId) return '—';
  if (order.buyer_id === userId) {
    const u = order.seller_username?.trim();
    if (u) return truncate(u, 14);
    return truncate(order.seller_id, 10);
  }
  if (order.seller_id === userId) {
    const u = order.buyer_username?.trim();
    if (u) return truncate(u, 14);
    return truncate(order.buyer_id, 10);
  }
  return '—';
}

export function pairLabel(order: P2POrder): string {
  const c = (order.crypto_symbol ?? '—').toUpperCase();
  const f = (order.fiat_currency ?? '—').toUpperCase();
  return `${c}/${f}`;
}

/** Unit price from backend fiat_amount ÷ quantity — no fake rates. */
export function unitPriceDisplay(order: P2POrder): string | null {
  const f = parseNum(order.fiat_amount);
  const q = parseNum(order.quantity);
  if (f == null || q == null || q === 0) return null;
  const p = f / q;
  if (!Number.isFinite(p)) return null;
  const fiat = order.fiat_currency ?? '';
  return `${formatFiatSymbol(fiat)}${formatP2pFiatPrice(String(p), fiat)}`;
}

export function fiatTotalDisplay(order: P2POrder): string {
  const fiat = order.fiat_currency ?? '';
  if (order.fiat_amount == null || String(order.fiat_amount).trim() === '') return '—';
  return `${formatFiatSymbol(fiat)}${formatP2pFiatPrice(String(order.fiat_amount), fiat)}`;
}

export function cryptoQtyDisplay(order: P2POrder): string {
  return formatP2pCryptoQty(order.quantity);
}

/** ADR-015 — time left recalculated from backend expires_at. */
export function formatOrderTimeLeft(order: P2POrder, nowMs = Date.now()): string {
  if (!order.expires_at || !TIME_SENSITIVE_ORDER_STATUSES.has(order.status)) return '—';
  const end = new Date(order.expires_at).getTime();
  if (Number.isNaN(end)) return '—';
  const ms = end - nowMs;
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 72) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

export function payMethodLabel(order: P2POrder): string {
  const n = order.seller_payment_method_name?.trim();
  if (n) return truncate(n, 18);
  const c = order.seller_payment_method_code?.trim();
  if (c) return truncate(c.replace(/_/g, ' '), 18);
  return '—';
}

export function orderIdShort(orderId: string): string {
  return `${orderId.slice(0, 8)}…`;
}

export function hasPaymentProof(order: P2POrder): boolean {
  return Boolean(order.payment_proof_url?.trim());
}

export function statusChipTone(status: string): 'pending' | 'confirmed' | 'done' | 'muted' | 'dispute' {
  switch (status) {
    case 'payment_pending':
      return 'pending';
    case 'payment_confirmed':
      return 'confirmed';
    case 'completed':
      return 'done';
    case 'disputed':
      return 'dispute';
    default:
      return 'muted';
  }
}

export function ordersNeedLiveRefresh(orders: P2POrder[]): boolean {
  return orders.some((o) => IN_PROGRESS_ORDER_STATUSES.has(o.status));
}
