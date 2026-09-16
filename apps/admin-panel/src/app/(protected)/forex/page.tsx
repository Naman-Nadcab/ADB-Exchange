'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminOverview, getForexAdminConfig } from '@/lib/admin/forex-api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ForexControlGrid } from '@/components/forex/ForexControlGrid';
import { ForexJsonPanel } from '@/components/forex/ForexJsonPanel';
import { StatCard } from '@/components/dashboard/StatCard';
import { FOREX_ADMIN_PHASES, FOREX_ADMIN_ROUTES } from '@/lib/admin/forex-admin-nav';
import { FOREX_CONTROL_GROUPS } from '@/lib/admin/forex-control-registry';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight, Layers, ShoppingCart, Users } from 'lucide-react';

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

  const counts = overviewQ.data?.counts;

  return (
    <AdminPageFrame
      title="Forex FDM Overview"
      description="F1: live read-only posture, KPIs, and config mirror from /api/v1/admin/forex/*."
      status={overviewQ.data?.readiness.economicReady ? 'active' : 'warning'}
      error={overviewQ.isError ? (overviewQ.error instanceof Error ? overviewQ.error.message : 'Load failed') : null}
      onRetry={() => overviewQ.refetch()}
      metrics={
        counts ? (
          <>
            <StatCard title="Open orders" value={String(counts.openOrders)} icon={ShoppingCart} />
            <StatCard title="Open positions" value={String(counts.openPositions)} icon={Layers} />
            <StatCard title="Ledger accounts" value={String(counts.ledgerAccounts)} icon={Users} />
            <StatCard
              title="Market worker"
              value={configQ.data?.runtime.marketData.running ? 'Running' : 'Stopped'}
              icon={Layers}
            />
          </>
        ) : undefined
      }
    >
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Rollout phases</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {FOREX_ADMIN_PHASES.map((p) => (
            <Card key={p.id} className="border-admin-border bg-admin-card/90">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.title}</span>
                  <Badge variant={p.id === 'F0' ? 'success' : 'default'}>{p.id}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-admin-muted">{p.summary}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">All admin sections</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FOREX_ADMIN_ROUTES.filter((r) => r.id !== 'overview').map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.id}
                href={r.href}
                className="group flex items-center gap-3 rounded-xl border border-admin-border bg-admin-card/50 p-3 transition hover:border-violet-500/40 hover:bg-violet-500/5"
              >
                <Icon className="h-5 w-5 text-violet-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.label}</p>
                  <p className="truncate text-xs text-admin-muted">{r.phase}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-admin-muted group-hover:text-violet-300" />
              </Link>
            );
          })}
        </div>
      </section>

      {configQ.data ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <ForexJsonPanel title="Admin config snapshot" data={configQ.data.config} />
          <ForexJsonPanel title="Runtime & readiness" data={{ readiness: configQ.data.readiness, runtime: configQ.data.runtime }} />
        </section>
      ) : null}

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Full control catalog (F0 map)</h2>
        <ForexControlGrid groups={FOREX_CONTROL_GROUPS} />
      </section>
    </AdminPageFrame>
  );
}
