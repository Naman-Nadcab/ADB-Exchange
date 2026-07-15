/** P2P Order Room — status machine, permissions, ADR-011 cache lookup. */

import type { QueryClient } from '@tanstack/react-query';
import type { P2POrder } from '@exchange/mobile-types';

export const P2P_ORDER_QUERY_KEY = (id: string) => ['p2p', 'order', id] as const;
export const P2P_ORDERS_LIST_KEY = ['p2p', 'orders'] as const;

export type OrderRoomRole = 'buyer' | 'seller' | 'none';

export type OrderStatusTimelineStep = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
  failed?: boolean;
};

export type OrderRoomPermissions = {
  canPay: boolean;
  canVerify: boolean;
  canRelease: boolean;
  canCancel: boolean;
  canDispute: boolean;
  chatEnabled: boolean;
  timerActive: boolean;
};

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'expired']);

const WEBSITE_STEPS = [
  { key: 'created', label: 'Created' },
  { key: 'payment', label: 'Payment' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
] as const;

const STATUS_STEP: Record<string, number> = {
  pending: 0,
  created: 0,
  escrow_funded: 1,
  payment_pending: 1,
  payment_sent: 2,
  payment_confirmed: 2,
  completed: 4,
  released: 4,
  cancelled: -1,
  expired: -1,
  disputed: 2,
};

export class P2POrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`);
    this.name = 'P2POrderNotFoundError';
  }
}

export function isTerminalOrderStatus(status: string | undefined): boolean {
  if (!status) return false;
  return TERMINAL_STATUSES.has(status);
}

export function resolveOrderRole(order: P2POrder, userId?: string | null): OrderRoomRole {
  if (!userId) return 'none';
  if (order.buyer_id === userId) return 'buyer';
  if (order.seller_id === userId) return 'seller';
  return 'none';
}

export function paymentVerificationGate(order: P2POrder): boolean {
  const pvs = order.payment_verification_status;
  if (pvs == null || pvs === '') return true;
  return pvs === 'verified';
}

export function getOrderRoomPermissions(order: P2POrder, role: OrderRoomRole): OrderRoomPermissions {
  const st = order.status;
  const pvs = order.payment_verification_status ?? null;
  const isBuyer = role === 'buyer';
  const isSeller = role === 'seller';

  return {
    canPay: isBuyer && st === 'payment_pending',
    canVerify: isSeller && st === 'payment_confirmed' && pvs === 'pending',
    canRelease: isSeller && st === 'payment_confirmed' && paymentVerificationGate(order),
    canCancel: (isBuyer || isSeller) && st === 'payment_pending',
    canDispute: (isBuyer || isSeller) && st === 'payment_confirmed',
    chatEnabled: !isTerminalOrderStatus(st) && st !== 'disputed',
    timerActive: st === 'payment_pending',
  };
}

export function orderStatusLabel(status: string): string {
  switch (status) {
    case 'payment_pending':
      return 'Awaiting Payment';
    case 'payment_confirmed':
      return 'Paid — Awaiting Release';
    case 'completed':
    case 'released':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    case 'disputed':
      return 'In Dispute';
    case 'payment_sent':
      return 'Payment Submitted';
    case 'created':
    case 'pending':
      return 'Created';
    case 'escrow_funded':
      return 'Escrow Funded';
    default:
      return status;
  }
}

export function verificationBadgeLabel(
  pvs: string | null | undefined,
): { label: string; tone: 'pending' | 'verified' | 'rejected' | 'neutral' } | null {
  if (pvs == null || pvs === '') return null;
  switch (pvs) {
    case 'pending':
      return { label: 'Payment check: pending', tone: 'pending' };
    case 'verified':
      return { label: 'Payment verified', tone: 'verified' };
    case 'rejected':
      return { label: 'Proof rejected', tone: 'rejected' };
    default:
      return { label: String(pvs), tone: 'neutral' };
  }
}

/** Website 4-step status timeline. */
export function buildOrderStatusTimeline(status: string): OrderStatusTimelineStep[] {
  const currentStep = STATUS_STEP[status] ?? 0;
  const failed = status === 'cancelled' || status === 'expired';

  return WEBSITE_STEPS.map((step, i) => {
    const done = currentStep > 0 && i < currentStep;
    const active = currentStep > 0 && i === currentStep;
    return {
      key: step.key,
      label: step.label,
      done,
      active,
      failed: failed && i === Math.max(0, currentStep - 1),
    };
  });
}

export function validateDisputeReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 10) return 'Reason must be at least 10 characters';
  if (trimmed.length > 1000) return 'Reason must be at most 1000 characters';
  return null;
}

export function validateTransactionReference(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed) return 'Enter your transaction reference';
  if (trimmed.length > 256) return 'Transaction reference must be at most 256 characters';
  return null;
}

export function validateCancelReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return 'Cancel reason is required';
  return null;
}

/** ADR-011 — resolve order from dedicated cache or orders list before GET. */
export function findOrderInQueryCache(qc: QueryClient, orderId: string): P2POrder | undefined {
  const direct = qc.getQueryData<P2POrder>(P2P_ORDER_QUERY_KEY(orderId));
  if (direct?.id === orderId) return direct;

  const lists = qc.getQueriesData<P2POrder[]>({ queryKey: P2P_ORDERS_LIST_KEY });
  for (const [, data] of lists) {
    const hit = data?.find((o) => o.id === orderId);
    if (hit) return hit;
  }
  return undefined;
}

export function pickPaymentDetail(details: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = details[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function formatPaymentDetailKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
