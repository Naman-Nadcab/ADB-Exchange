'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminOverview, getForexAdminConfig, getForexAdminExecution } from '@/lib/admin/forex-api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { StatCard } from '@/components/dashboard/StatCard';
import { FOREX_NAV_GROUPS, forexRoutesInGroup } from '@/lib/admin/forex-nav-groups';
import { ForexCommandDeskPanel } from '@/components/forex/panels/ForexCommandDeskPanel';
import { ForexOverviewCharts } from '@/components/forex/panels/ForexOverviewCharts';
import { Badge } from '@/components/ui/Badge';
import { KpiSkeleton } from '@/components/ui/Skeleton';
import { deriveForexVenueMode } from '@/lib/admin/forex-posture';
import { ChevronRight, Layers, Radio, Shield, ShoppingCart, SlidersHorizontal, Users } from 'lucide-react';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';

export default function ForexAdminOverviewPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const overviewQ = useQuery({
    queryKey: ['admin', 'forex', 'overview', token],
    queryFn: async () => {
      const res = await getForexAdminOverview(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });
  const configQ = useQuery({
    queryKey: ['admin', 'forex', 'config', token],
    queryFn: async () => {
      const res = await getForexAdminConfig(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 30_000,
  });
  const execQ = useQuery({
    queryKey: ['admin', 'forex', 'execution', 'overview-chart', token],
    queryFn: async () => {
      const res = await getForexAdminExecution(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const counts = overviewQ.data?.counts;
  const ready = overviewQ.data?.readiness.economicReady;
  const posture = overviewQ.data?.posture;
  const venue = deriveForexVenueMode(posture);
  const venueBadgeVariant =
    venue.mode === 'LIVE' ? 'danger' : venue.mode === 'SIMULATED' ? 'warning' : 'info';

  return (
    <AdminPageFrame
      title="Forex overview"
      description="Operator home — posture, volume, and shortcuts into each desk."
      status={ready ? 'active' : 'warning'}
      error={overviewQ.isError ? (overviewQ.error instanceof Error ? overviewQ.error.message : 'Load failed') : null}
      onRetry={() => overviewQ.refetch()}
      quickActions={
        overviewQ.data ? (
          <Badge variant={venueBadgeVariant} className="font-semibold">
            {venue.mode} venue
          </Badge>
        ) : undefined
      }
      metrics={
        counts ? (
          <>
            <StatCard title="Open orders" value={String(counts.openOrders)} icon={ShoppingCart} href="/forex/orders" />
            <StatCard title="Open positions" value={String(counts.openPositions)} icon={Layers} href="/forex/positions" />
            <StatCard title="Ledger accounts" value={String(counts.ledgerAccounts)} icon={Users} href="/forex/accounts" />
            <StatCard
              title="Quote worker"
              value={configQ.data?.runtime.marketData.running ? 'Running' : 'Stopped'}
              icon={Radio}
              href="/forex/market-data"
            />
          </>
        ) : overviewQ.isLoading ? (
          <KpiSkeleton count={4} />
        ) : undefined
      }
    >
      <ForexWorkspaceHeader
        title="Forex overview"
        purpose="Operator home — posture, volume KPIs, attention queue, and desk shortcuts."
        dataSource="GET /forex/overview · GET /forex/config"
        posture={venue.mode === 'LIVE' ? 'LIVE' : venue.mode === 'SIMULATED' ? 'SIMULATED' : 'MOCK'}
        kpis={
          counts
            ? [
                { label: 'Open orders', value: String(counts.openOrders) },
                { label: 'Open positions', value: String(counts.openPositions) },
                { label: 'Ledger accounts', value: String(counts.ledgerAccounts) },
              ]
            : undefined
        }
      />
      {counts ? (
        <ForexOverviewCharts
          openOrders={counts.openOrders}
          openPositions={counts.openPositions}
          ledgerAccounts={counts.ledgerAccounts}
          filled24h={execQ.data?.fillRecon?.totals.filled}
          failed24h={execQ.data?.fillRecon?.totals.failed}
          killSwitch={posture?.killSwitch}
          economicReady={ready}
        />
      ) : null}

      <ForexCommandDeskPanel overview={overviewQ.data} system={undefined} loading={overviewQ.isLoading} />

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Desks</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {FOREX_NAV_GROUPS.filter((g) => g.id !== 'command').map((group) => {
            const routes = forexRoutesInGroup(group.id);
            const Icon =
              group.id === 'markets'
                ? Radio
                : group.id === 'trading'
                  ? ShoppingCart
                  : group.id === 'risk'
                    ? Shield
                    : group.id === 'accounts'
                      ? Users
                      : group.id === 'liquidity'
                        ? Radio
                        : SlidersHorizontal;
            return (
              <div
                key={group.id}
                className="rounded-xl border border-admin-border bg-admin-card/80 p-4 transition hover:border-violet-500/30"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-violet-400" />
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                </div>
                <p className="mb-3 text-xs text-admin-muted">{group.description}</p>
                <ul className="space-y-1">
                  {routes.slice(0, 4).map((r) => (
                    <li key={r.id}>
                      <Link
                        href={r.href}
                        className="group flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-admin-muted hover:bg-white/5 hover:text-foreground"
                      >
                        <span>{r.label}</span>
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </AdminPageFrame>
  );
}
