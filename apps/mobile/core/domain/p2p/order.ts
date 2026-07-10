/** P2P display helpers — no financial calculation. */

import type { P2POrderStatus } from '@exchange/mobile-types';

export type EscrowTimelineStep = {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
};

const STATUS_ORDER = [
  'created',
  'escrow_funded',
  'payment_pending',
  'payment_sent',
  'payment_confirmed',
  'released',
] as const;

export function displayOrderStatus(status: P2POrderStatus): string {
  const map: Record<string, string> = {
    created: 'Created',
    escrow_funded: 'Escrow Funded',
    payment_pending: 'Payment Pending',
    payment_sent: 'Payment Sent',
    payment_confirmed: 'Payment Confirmed',
    released: 'Released',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
    expired: 'Expired',
  };
  return map[status] ?? status;
}

/** Timeline derived from backend status only — no local escrow math. */
export function buildEscrowTimeline(status: P2POrderStatus): EscrowTimelineStep[] {
  const cancelled = status === 'cancelled' || status === 'expired';
  const disputed = status === 'disputed';
  const idx = STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);

  const steps: EscrowTimelineStep[] = [
    { key: 'created', label: 'Order Created', done: idx >= 0 || cancelled || disputed, active: status === 'created' },
    { key: 'escrow_funded', label: 'Escrow Funded', done: idx >= 1 || cancelled || disputed, active: status === 'escrow_funded' },
    { key: 'payment_pending', label: 'Payment Pending', done: idx >= 2 || cancelled || disputed, active: status === 'payment_pending' },
    { key: 'payment_sent', label: 'Payment Sent', done: idx >= 3 || cancelled || disputed, active: status === 'payment_sent' },
    { key: 'payment_confirmed', label: 'Payment Confirmed', done: idx >= 4 || cancelled || disputed, active: status === 'payment_confirmed' },
    { key: 'released', label: 'Released', done: status === 'released', active: status === 'released' },
  ];

  if (cancelled) {
    steps.push({ key: 'cancelled', label: 'Cancelled', done: true, active: true });
  }
  if (disputed) {
    steps.push({ key: 'disputed', label: 'Disputed', done: true, active: true });
  }
  return steps;
}

export function validateOrderQuantity(qty: string, min?: string, max?: string, available?: string): string | null {
  const n = parseFloat(qty);
  if (!Number.isFinite(n) || n <= 0) return 'Enter a valid amount';
  const minN = min ? parseFloat(min) : NaN;
  const maxN = max ? parseFloat(max) : NaN;
  const availN = available ? parseFloat(available) : NaN;
  if (Number.isFinite(minN) && n < minN) return `Minimum is ${min}`;
  if (Number.isFinite(maxN) && n > maxN) return `Maximum is ${max}`;
  if (Number.isFinite(availN) && n > availN) return 'Exceeds available amount';
  return null;
}

export function getAdSide(ad: { ad_type?: string; type?: string }): 'buy' | 'sell' {
  const t = (ad.ad_type ?? ad.type ?? 'sell').toLowerCase();
  return t === 'buy' ? 'buy' : 'sell';
}

export function getAdPrice(ad: { current_price?: string; price?: string }): string {
  return ad.current_price ?? ad.price ?? '0';
}
