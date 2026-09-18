'use client';

import { useQuery } from '@tanstack/react-query';
import type { ForexAdminOverviewResponse, ForexAdminSystemResponse } from '@/lib/admin/forex-api';
import { getForexAdminCommandAttention } from '@/lib/admin/forex-api';
import { useAdminAuthStore } from '@/store/auth';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexMetricTile } from '@/components/forex/primitives/ForexMetricTile';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiSkeleton } from '@/components/ui/Skeleton';
import { Activity, AlertTriangle, Layers, Server, ShoppingCart, SlidersHorizontal, Users } from 'lucide-react';
import { ForexGlobalSearchBar } from '@/components/forex/panels/ForexGlobalSearchBar';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import { ForexAttentionCard } from '@/components/forex/primitives/forex-visual-kit';

function friendlySource(source: string | undefined): string {
  const s = (source ?? 'SIMULATED').toUpperCase();
  if (s.includes('SIM')) return 'Simulated quotes';
  if (s.includes('LIVE') || s.includes('REAL')) return 'Live quotes';
  return source ?? 'Unknown';
}

function friendlyExecution(mode: string | undefined): string {
  const m = (mode ?? 'MOCK').toUpperCase();
  if (m.includes('MOCK')) return 'Mock venue (no real LP fills)';
  return mode ?? 'Unknown';
}

export function ForexCommandDeskPanel(props: {
  overview: ForexAdminOverviewResponse | undefined;
  system: ForexAdminSystemResponse | undefined;
  loading?: boolean;
}) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const attentionQ = useQuery({
    queryKey: ['admin', 'forex', 'command', 'attention', token],
    queryFn: async () => {
      const res = await getForexAdminCommandAttention(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load attention queue');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const counts = props.overview?.counts;
  const posture = props.overview?.posture;
  const ready = props.overview?.readiness?.economicReady;
  const md = props.system?.marketData;
  const attention = attentionQ.data;

  if (props.loading && !props.overview) {
    return <KpiSkeleton count={4} />;
  }

  return (
    <div className="admin-stack-lg">
      <ForexWorkspaceHeader
        title="Command desk"
        purpose="Cross-domain attention queue, venue posture, and operator search — what needs action now."
        dataSource="PostgreSQL + runtime flags (MOCK/SIMULATED execution)"
        posture="MOCK"
        kpis={[
          { label: 'Open orders', value: String(counts?.openOrders ?? '—') },
          { label: 'Open positions', value: String(counts?.openPositions ?? '—') },
          { label: 'Kill switch', value: posture?.killSwitch ? 'ON' : 'Off', tone: posture?.killSwitch ? 'danger' : 'success' },
          { label: 'Economic ready', value: ready ? 'Yes' : 'No', tone: ready ? 'success' : 'warning' },
        ]}
      />
      <ForexPanelShell
        title="What needs attention now"
        description="Actionable queue across dealing, finance, compliance, CRM, and infrastructure — drill through to the owning workspace."
        actions={
          <Button type="button" size="sm" variant="ghost" onClick={() => void attentionQ.refetch()} disabled={attentionQ.isFetching}>
            Refresh
          </Button>
        }
      >
        {attentionQ.isError ? (
          <p className="text-sm text-red-400">{attentionQ.error instanceof Error ? attentionQ.error.message : 'Attention queue unavailable'}</p>
        ) : attentionQ.isLoading && !attention ? (
          <KpiSkeleton count={2} />
        ) : attention && attention.items.length === 0 ? (
          <p className="text-sm text-admin-muted">No open attention items — continue monitoring posture and queue depth below.</p>
        ) : attention ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {attention.items.map((item) => (
                <ForexAttentionCard
                  key={`${item.category}-${item.title}-${item.href}`}
                  severity={item.severity}
                  category={item.category}
                  title={item.title}
                  detail={item.detail}
                  count={item.count}
                  href={item.href}
                />
              ))}
            </div>
            {(attention.totals.critical > 0 || attention.totals.high > 0) && (
              <p className="mt-3 flex items-center gap-2 text-xs text-amber-400/90">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {attention.totals.critical} critical · {attention.totals.high} high priority
              </p>
            )}
          </>
        ) : null}
      </ForexPanelShell>

      <ForexPanelShell title="Global search" description="RBAC-scoped operator search across CRM, orders, finance, compliance.">
        <ForexGlobalSearchBar />
      </ForexPanelShell>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ForexMetricTile
          label="Open orders"
          value={counts?.openOrders ?? (props.loading ? '—' : '0')}
          icon={ShoppingCart}
        />
        <ForexMetricTile
          label="Open positions"
          value={counts?.openPositions ?? (props.loading ? '—' : '0')}
          icon={Layers}
        />
        <ForexMetricTile
          label="Ledger accounts"
          value={counts?.ledgerAccounts ?? (props.loading ? '—' : '0')}
          icon={Users}
        />
        <ForexMetricTile
          label="Trading readiness"
          value={ready ? 'Ready' : 'Not ready'}
          tone={ready ? 'success' : 'warning'}
          hint={props.overview?.readiness?.reason ?? undefined}
          icon={Activity}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ForexPanelShell title="Venue posture" description="Live execution and quote source for operators">
          <ForexDetailGrid
            items={[
              {
                label: 'Quote source',
                value: friendlySource(posture?.source),
                highlight: 'warning',
              },
              {
                label: 'Execution mode',
                value: friendlyExecution(posture?.executionMode),
                highlight: 'warning',
              },
              {
                label: 'REAL money path',
                value: posture?.realForex ? 'ARMED' : 'Blocked',
                highlight: posture?.realForex ? 'danger' : 'success',
              },
              {
                label: 'Kill switch',
                value: posture?.killSwitch ? 'ON' : 'Off',
                highlight: posture?.killSwitch ? 'danger' : 'success',
              },
              {
                label: 'Demo funding',
                value: posture?.demoFundingEnabled ? 'Enabled' : 'Disabled',
              },
            ]}
          />
        </ForexPanelShell>

        <ForexPanelShell title="Market data worker" description="Quote hydration and symbol coverage">
          {md ? (
            <ForexDetailGrid
              columns={3}
              items={[
                {
                  label: 'Worker',
                  value: md.running ? 'Running' : 'Stopped',
                  highlight: md.running ? 'success' : 'danger',
                },
                { label: 'Enabled', value: md.enabled ? 'Yes' : 'No' },
                { label: 'Source', value: md.source, mono: true },
                { label: 'Symbols', value: md.symbols },
                { label: 'Interval', value: `${md.intervalMs} ms`, mono: true },
                {
                  label: 'Providers',
                  value: md.providers?.length ? md.providers.join(', ') : '—',
                  mono: true,
                },
              ]}
            />
          ) : (
            <p className="text-sm text-admin-muted">{props.loading ? 'Loading…' : 'No system telemetry.'}</p>
          )}
        </ForexPanelShell>
      </div>

      {props.system?.flags ? (
        <ForexPanelShell title="Platform flags" description="Environment and runtime switches surfaced for ops review">
          <div className="flex flex-wrap gap-2">
            {Object.entries(props.system.flags).map(([key, on]) => (
              <Badge key={key} variant={on ? 'success' : 'default'} className="font-normal">
                {key.replace(/([A-Z])/g, ' $1').trim()}: {on ? 'ON' : 'off'}
              </Badge>
            ))}
          </div>
        </ForexPanelShell>
      ) : null}

      <ForexPanelShell title="Incident shortcuts" description="Audited actions — always enter an ops reason where required.">
        <div className="flex flex-wrap gap-2">
          <Link href="/forex/controls">
            <Button type="button" variant="secondary" size="sm" className="gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Global controls
            </Button>
          </Link>
          <Link href="/forex/instruments">
            <Button type="button" variant="secondary" size="sm">
              Halt instruments
            </Button>
          </Link>
          <Link href="/forex/lp-execution">
            <Button type="button" variant="secondary" size="sm">
              LP & execution
            </Button>
          </Link>
          <Link href="/forex/system">
            <Button type="button" variant="secondary" size="sm" className="gap-1">
              <Server className="h-3.5 w-3.5" />
              System health
            </Button>
          </Link>
        </div>
        <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-admin-muted">
          <li>Customer forex balances live on an isolated ledger — not crypto spot wallets.</li>
          <li>Simulated venue is expected until live money path is certified and armed.</li>
        </ul>
      </ForexPanelShell>

    </div>
  );
}
