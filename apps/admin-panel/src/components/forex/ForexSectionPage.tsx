'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminConfig, getForexAdminOverview, getForexAdminSystem } from '@/lib/admin/forex-api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ForexControlGrid } from '@/components/forex/ForexControlGrid';
import { ForexJsonPanel } from '@/components/forex/ForexJsonPanel';
import { ForexAdminOpsTable, type ForexOpsTableKind } from '@/components/forex/ForexAdminOpsTable';
import { ForexGlobalControlsPanel } from '@/components/forex/ForexGlobalControlsPanel';
import { ForexPolicyPanel } from '@/components/forex/ForexPolicyPanel';
import { ForexExecutionPanel } from '@/components/forex/ForexExecutionPanel';
import { controlGroupsForRoute } from '@/lib/admin/forex-control-registry';
import type { ForexAdminRoute } from '@/lib/admin/forex-admin-nav';
import { FOREX_ADMIN_PHASES } from '@/lib/admin/forex-admin-nav';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const F1_LIVE_SECTIONS = new Set(['command', 'instruments', 'sessions', 'system']);
const F2_LIVE_SECTIONS = new Set(['orders', 'executions', 'positions']);
const F3_LIVE_SECTIONS = new Set(['controls']);
const F4_LIVE_SECTIONS = new Set(['fees-swaps', 'margin-risk']);
const F5_LIVE_SECTIONS = new Set(['lp-execution']);

const F2_TABLE_KIND: Record<string, ForexOpsTableKind> = {
  orders: 'orders',
  executions: 'executions',
  positions: 'positions',
};

export function ForexSectionPage({ route }: { route: ForexAdminRoute }) {
  const groups = controlGroupsForRoute(route.href);
  const phaseMeta = FOREX_ADMIN_PHASES.find((p) => p.id === route.phase);
  const token = useAdminAuthStore((s) => s.accessToken);
  const f1Live = F1_LIVE_SECTIONS.has(route.id);
  const f2Live = F2_LIVE_SECTIONS.has(route.id);
  const f3Live = F3_LIVE_SECTIONS.has(route.id);
  const f4Live = F4_LIVE_SECTIONS.has(route.id);
  const f5Live = F5_LIVE_SECTIONS.has(route.id);
  const liveReadOnly = f1Live || f2Live;
  const liveSection = f3Live || f4Live || f5Live || liveReadOnly;

  const configQ = useQuery({
    queryKey: ['admin', 'forex', 'config', token],
    queryFn: async () => {
      const res = await getForexAdminConfig(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && f1Live,
    staleTime: 30_000,
  });

  const overviewQ = useQuery({
    queryKey: ['admin', 'forex', 'overview', token],
    queryFn: async () => {
      const res = await getForexAdminOverview(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && route.id === 'command',
    staleTime: 15_000,
  });

  const systemQ = useQuery({
    queryKey: ['admin', 'forex', 'system', token],
    queryFn: async () => {
      const res = await getForexAdminSystem(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && (route.id === 'system' || route.id === 'command'),
    staleTime: 15_000,
  });

  const loadError = configQ.isError
    ? configQ.error
    : overviewQ.isError
      ? overviewQ.error
      : systemQ.isError
        ? systemQ.error
        : null;

  return (
    <AdminPageFrame
      title={route.label}
      description={route.description}
      status={
        f5Live || (route.phase === 'F5' && !f5Live)
          ? 'warning'
          : liveSection && configQ.data?.readiness.economicReady === false
            ? 'warning'
            : 'active'
      }
      error={loadError instanceof Error ? loadError.message : loadError ? String(loadError) : null}
      onRetry={() => {
        void configQ.refetch();
        void overviewQ.refetch();
        void systemQ.refetch();
      }}
      quickActions={
        <Badge variant="info" className="font-normal">
          {f5Live
            ? 'F5 live LP gate'
            : f4Live
              ? 'F4 live policy'
              : f3Live
                ? 'F3 live controls'
                : f2Live
                  ? 'F2 live read-only'
                  : f1Live
                    ? 'F1 live read-only'
                    : `Rollout ${route.phase}`}{' '}
          —{' '}
          {phaseMeta?.title ?? route.phase}
        </Badge>
      }
    >
      {f5Live ? (
        <ForexExecutionPanel />
      ) : f4Live ? (
        <ForexPolicyPanel mode={route.id === 'fees-swaps' ? 'fees-swaps' : 'margin-risk'} />
      ) : f3Live ? (
        <ForexGlobalControlsPanel />
      ) : f2Live ? (
        <ForexAdminOpsTable kind={F2_TABLE_KIND[route.id] ?? 'orders'} />
      ) : f1Live ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {route.id === 'instruments' && configQ.data ? (
            <ForexJsonPanel title="Instrument catalog" data={configQ.data.config.instruments} className="lg:col-span-2" />
          ) : null}
          {route.id === 'sessions' && configQ.data ? (
            <ForexJsonPanel title="Sessions & holidays" data={configQ.data.config.sessions} className="lg:col-span-2" />
          ) : null}
          {route.id === 'command' ? (
            <>
              {overviewQ.data ? <ForexJsonPanel title="Live KPIs & posture" data={overviewQ.data} /> : null}
              {systemQ.data ? <ForexJsonPanel title="System flags" data={systemQ.data} /> : null}
            </>
          ) : null}
          {route.id === 'system' && systemQ.data ? (
            <ForexJsonPanel title="System diagnostics" data={systemQ.data} className="lg:col-span-2" />
          ) : null}
        </div>
      ) : (
        <Card className="border-dashed border-violet-500/25 bg-violet-500/5">
          <CardContent className="py-3 text-sm text-admin-muted">
            Planned controls for phase <strong className="text-foreground">{route.phase}</strong>. F1/F2 read-only data is
            on Command Desk, Instruments, Sessions, System, Orders, Executions, and Positions.
          </CardContent>
        </Card>
      )}

      <ForexControlGrid groups={groups.length ? groups : controlGroupsForRoute('/forex')} compact />
    </AdminPageFrame>
  );
}
