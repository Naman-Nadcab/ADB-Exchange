/** P2P Merchant Center — stats, ad breakdown, state machine (backend-driven). */

import type { QueryClient } from '@tanstack/react-query';
import type { P2PAd, P2POrder, P2PMerchantStats } from '@exchange/mobile-types';

const P2P_ADS_LIST_KEY = ['p2p', 'ads'] as const;

export type MerchantAdCounts = {
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
  total: number;
};

export type MerchantDashboardStat = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  progress?: number | null;
};

export type MerchantProfileView = {
  advertiserId: string;
  username: string;
  verified: boolean;
  totalOrders: number;
  completionLabel: string;
  headAd: P2PAd;
};

const AD_TERMINAL = new Set(['completed', 'cancelled']);

/** ADR-014 — ad status transitions allowed by backend. */
export function canPatchAdStatus(current: string, next: 'active' | 'paused'): boolean {
  const st = current.toLowerCase();
  if (AD_TERMINAL.has(st)) return false;
  if (next === 'paused') return st === 'active';
  if (next === 'active') return st === 'paused';
  return false;
}

export function canDeleteAd(current: string): boolean {
  return !AD_TERMINAL.has(current.toLowerCase());
}

export function formatCompletionRate(rate: unknown): string {
  if (rate == null || rate === '') return '—';
  const n = Number(rate);
  return Number.isFinite(n) ? `${n}%` : String(rate);
}

export function formatAvgReleaseMinutes(stats: P2PMerchantStats | null | undefined): string {
  if (!stats) return '—';
  const raw = stats.avg_release_time ?? stats.avg_release_time_minutes ?? stats.average_release_time;
  if (raw == null || raw === '') return '—';
  return String(raw);
}

export function isVerifiedMerchant(stats: P2PMerchantStats | null | undefined): boolean {
  if (!stats) return false;
  if (typeof stats.verified_merchant === 'boolean') return stats.verified_merchant;
  return false;
}

export function countCompletedOrders(orders: P2POrder[]): number {
  return orders.filter((o) => o.status === 'completed').length;
}

/** Sum fiat from completed orders — same as website merchant dashboard. */
export function computeCompletedFiatVolume(orders: P2POrder[]): number {
  return orders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + (parseFloat(o.fiat_amount ?? '0') || 0), 0);
}

export function countAdsByStatus(ads: P2PAd[]): MerchantAdCounts {
  const counts: MerchantAdCounts = { active: 0, paused: 0, completed: 0, cancelled: 0, total: ads.length };
  for (const ad of ads) {
    const st = String(ad.status ?? 'active').toLowerCase();
    if (st === 'active') counts.active += 1;
    else if (st === 'paused') counts.paused += 1;
    else if (st === 'completed') counts.completed += 1;
    else if (st === 'cancelled') counts.cancelled += 1;
  }
  return counts;
}

export function buildDashboardStatCards(
  stats: P2PMerchantStats | null | undefined,
  orders: P2POrder[],
): MerchantDashboardStat[] {
  const completionRaw = stats?.completion_rate;
  const completionN = completionRaw != null ? Number(completionRaw) : NaN;
  const completedRecent = countCompletedOrders(orders);

  return [
    {
      key: 'completion',
      label: 'Completion Rate',
      value: formatCompletionRate(completionRaw),
      progress: Number.isFinite(completionN) ? completionN : null,
    },
    {
      key: 'total_orders',
      label: 'Total Orders',
      value: stats?.total_orders != null ? String(stats.total_orders) : '—',
      sub: 'All time',
    },
    {
      key: 'avg_release',
      label: 'Avg Release',
      value: formatAvgReleaseMinutes(stats),
      sub: 'Minutes',
    },
    {
      key: 'completed_recent',
      label: 'Completed',
      value: String(completedRecent),
      sub: 'Recent orders',
    },
  ];
}

export function merchantProfileFromAds(ads: P2PAd[], advertiserId: string): MerchantProfileView | null {
  const head = ads[0];
  if (!head) return null;
  const completion =
    head.merchant_completion_rate != null ? `${head.merchant_completion_rate}%` : '—';
  return {
    advertiserId,
    username: head.username || 'Merchant',
    verified: Boolean(head.verified_merchant),
    totalOrders: Number(head.merchant_total_orders ?? 0),
    completionLabel: completion,
    headAd: head,
  };
}

/** ADR-011 — seed merchant profile from ad detail / marketplace cache. */
export function findMerchantSeedInCache(qc: QueryClient, advertiserId: string): P2PAd | undefined {
  const lists = qc.getQueriesData<P2PAd[]>({ queryKey: P2P_ADS_LIST_KEY });
  for (const [, data] of lists) {
    if (!Array.isArray(data)) continue;
    const hit = data.find((a) => a.user_id === advertiserId);
    if (hit) return hit;
  }

  const infinite = qc.getQueriesData<{ pages?: P2PAd[][] }>({ queryKey: P2P_ADS_LIST_KEY });
  for (const [, data] of infinite) {
    const flat = data?.pages?.flat() ?? [];
    const hit = flat.find((a) => a.user_id === advertiserId);
    if (hit) return hit;
  }

  const adEntries = qc.getQueriesData<P2PAd>({ queryKey: ['p2p', 'ad'] });
  for (const [, ad] of adEntries) {
    if (ad?.user_id === advertiserId) return ad;
  }

  return undefined;
}
