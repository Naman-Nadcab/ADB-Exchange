/**
 * Hover data-prefetch registry.
 *
 * The sidebar already prefetches each route's JS bundle on hover
 * (`router.prefetch`). This goes one step further: it warms React Query's
 * cache with each high-traffic route's *first-mount* query BEFORE the click,
 * so the page renders with data already present instead of a fetch-on-mount
 * spinner.
 *
 * Keys here MUST match the page's first-mount `queryKey` EXACTLY (same shape
 * and default params), otherwise the prefetch lands under a different cache
 * entry and is wasted. Each entry is annotated with its source page.
 *
 * Only stable, deterministic first-mount keys are registered — pages whose
 * initial key depends on volatile UI state (search text, etc.) are skipped to
 * avoid cache misses / duplicate fetches.
 */
import type { QueryClient } from '@tanstack/react-query';
import { getDashboardSummary, getSystemHealth, getControlOverview, getDashboardStats } from '@/lib/api';
import { getUsers } from '@/lib/users-api';
import { getTradingOverview } from '@/lib/trading-api';
import { getWithdrawalsList } from '@/lib/withdrawals-api';

type PrefetchFn = (qc: QueryClient, token: string | null) => void;

/** Shared staleTime: matches the pages' own settings so no redundant refetch on mount. */
const STALE = 30_000;

const REGISTRY: Record<string, PrefetchFn> = {
  // dashboard/page.tsx (lines ~118-135)
  '/dashboard': (qc, token) => {
    qc.prefetchQuery({ queryKey: ['admin', 'dashboard-summary'], queryFn: ({ signal }) => getDashboardSummary(token, signal), staleTime: STALE });
    qc.prefetchQuery({ queryKey: ['admin', 'system-health'], queryFn: ({ signal }) => getSystemHealth(token, signal), staleTime: STALE });
    qc.prefetchQuery({ queryKey: ['admin', 'control'], queryFn: ({ signal }) => getControlOverview(token, signal), staleTime: STALE });
  },
  // users/page.tsx (lines ~193-203): default queryParams = { page: 1, limit: 20 }
  '/users': (qc, token) => {
    qc.prefetchQuery({ queryKey: ['admin', 'dashboard-stats', token], queryFn: () => getDashboardStats(token), staleTime: STALE });
    qc.prefetchQuery({ queryKey: ['admin', 'users', token, { page: 1, limit: 20 }], queryFn: () => getUsers(token, { page: 1, limit: 20 }), staleTime: STALE });
  },
  // trades/page.tsx (line ~157): stable overview key
  '/trades': (qc, token) => {
    qc.prefetchQuery({ queryKey: ['admin', 'trading', 'overview', token], queryFn: () => getTradingOverview(token), staleTime: STALE });
  },
  // withdrawals/page.tsx (lines ~128-135): default page=1, status='all', search=''
  '/withdrawals': (qc, token) => {
    qc.prefetchQuery({ queryKey: ['admin', 'withdrawals', token, 1, 'all', ''], queryFn: () => getWithdrawalsList(token, { page: 1, limit: 25, status: undefined }), staleTime: STALE });
  },
};

/** Fire-and-forget: warm a route's first-mount query on hover. No-op for unregistered routes. */
export function prefetchRouteData(qc: QueryClient, href: string, token: string | null): void {
  if (!token) return;
  REGISTRY[href]?.(qc, token);
}
