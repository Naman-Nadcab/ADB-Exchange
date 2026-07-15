/** P2P dispute — display helpers mirroring website p2p-v2/disputes/[id]. */

import type { QueryClient } from '@tanstack/react-query';
import type { P2PDispute } from '@exchange/mobile-types';
import { formatFiatSymbol, formatP2pCryptoQty, formatP2pFiatPrice } from './marketplace';

export const P2P_DISPUTE_QUERY_KEY = (id: string) => ['p2p', 'dispute', id] as const;

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const DISPUTE_RESOLUTION_LABEL: Record<string, string> = {
  favor_buyer: 'Favor Buyer',
  favor_seller: 'Favor Seller',
  cancelled: 'Cancelled',
};

export type DisputeStatusTone = 'open' | 'resolved' | 'closed' | 'muted';

const TERMINAL_DISPUTE_STATUSES = new Set(['resolved', 'closed']);

export function disputeStatusLabel(status: string): string {
  return DISPUTE_STATUS_LABEL[status] ?? status.replace(/_/g, ' ');
}

export function disputeResolutionLabel(resolution: string): string {
  return DISPUTE_RESOLUTION_LABEL[resolution] ?? resolution.replace(/_/g, ' ');
}

export function disputeStatusChipTone(status: string): DisputeStatusTone {
  switch (status) {
    case 'open':
      return 'open';
    case 'resolved':
      return 'resolved';
    case 'closed':
      return 'closed';
    default:
      return 'muted';
  }
}

export function isTerminalDisputeStatus(status: string): boolean {
  return TERMINAL_DISPUTE_STATUSES.has(status);
}

export function formatOrderStatusDisplay(orderStatus: string): string {
  return orderStatus.replace(/_/g, ' ');
}

export function disputeIdShort(id: string): string {
  return `${id.slice(0, 12)}…`;
}

export function orderIdShort(id: string): string {
  return `${id.slice(0, 12)}…`;
}

export function normalizeDisputeEvidence(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  return evidence.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function orderFiatDisplay(dispute: P2PDispute): string | null {
  if (dispute.order_fiat_amount == null || String(dispute.order_fiat_amount).trim() === '') return null;
  const fiat = dispute.order_fiat_currency ?? '';
  return `${formatFiatSymbol(fiat)}${formatP2pFiatPrice(String(dispute.order_fiat_amount), fiat)}`;
}

export function orderQtyDisplay(dispute: P2PDispute): string | null {
  if (dispute.order_quantity == null || String(dispute.order_quantity).trim() === '') return null;
  return formatP2pCryptoQty(String(dispute.order_quantity));
}

/** History entries from backend timestamps only — no fabricated steps. */
export function buildDisputeHistoryEntries(dispute: P2PDispute): Array<{ label: string; at: string }> {
  const entries: Array<{ label: string; at: string }> = [];
  if (dispute.created_at) {
    entries.push({ label: 'Dispute opened', at: dispute.created_at });
  }
  if (dispute.status === 'resolved' && dispute.resolved_at) {
    entries.push({ label: 'Dispute resolved', at: dispute.resolved_at });
  } else if (dispute.status === 'closed' && dispute.resolved_at) {
    entries.push({ label: 'Dispute closed', at: dispute.resolved_at });
  }
  return entries;
}

/** ADR-011 — dispute from React Query cache. */
export function findDisputeInQueryCache(qc: QueryClient, disputeId: string): P2PDispute | undefined {
  const cached = qc.getQueryData<P2PDispute>(P2P_DISPUTE_QUERY_KEY(disputeId));
  if (cached?.id === disputeId) return cached;
  return undefined;
}
