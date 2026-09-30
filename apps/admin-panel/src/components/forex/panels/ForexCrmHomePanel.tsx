'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminCrmHome,
  getForexAdminCrmRecentActivities,
  type ForexCrmHomeSnapshot,
  type ForexCrmRecentActivity,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ForexMetricTile } from '@/components/forex/primitives/ForexMetricTile';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexRouteWorkspace } from '@/components/forex/primitives/ForexRouteWorkspace';

type StageRow = ForexCrmHomeSnapshot['funnel']['by_stage'][number];

function activityKindLabel(kind: string) {
  const k = kind.toUpperCase();
  if (k.includes('CALL')) return 'Call';
  if (k.includes('EMAIL')) return 'Email';
  if (k.includes('MEET')) return 'Meeting';
  if (k.includes('NOTE')) return 'Note';
  if (k.includes('TASK')) return 'Task';
  if (k.includes('KYC')) return 'KYC';
  if (k.includes('ONBOARD')) return 'Onboarding';
  return kind || 'Activity';
}

export function ForexCrmHomePanel() {
  const token = useAdminAuthStore((s) => s.accessToken);

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'home', token],
    queryFn: async () => {
      const res = await getForexAdminCrmHome(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const activitiesQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'activities', 'recent', token],
    queryFn: async () => {
      const res = await getForexAdminCrmRecentActivities(token, 25);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Activities failed');
      return res.data.rows;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const columns = useMemo<ColumnDef<StageRow>[]>(
    () => [
      { accessorKey: 'label', header: 'Stage' },
      { accessorKey: 'open_count', header: 'Open leads' },
    ],
    [],
  );

  const snap = qry.data;

  return (
    <div className="space-y-4">
      <ForexRouteWorkspace
        routeId="crm-home"
        kpis={
          snap
            ? [
                { label: 'Open leads', value: String(snap.funnel.open_leads) },
                { label: 'Forex accounts', value: String(snap.clients.forex_accounts) },
                { label: 'Tasks overdue', value: String(snap.tasks.overdue), tone: snap.tasks.overdue > 0 ? 'warning' : 'default' },
                {
                  label: 'Open positions',
                  value: String(snap.clients.with_open_positions),
                  tone: snap.clients.with_open_positions > 0 ? 'success' : 'default',
                },
              ]
            : undefined
        }
      />
      <ForexPanelShell
        title="CRM home"
        description="Institutional CRM overview — all metrics from PostgreSQL (no forecast KPIs)."
        actions={
          <div className="flex gap-2">
            <Link
              href="/forex/crm/my-clients"
              className="inline-flex h-8 items-center rounded-md px-3 text-sm text-admin-muted hover:bg-admin-surface hover:text-admin-fg"
            >
              My clients
            </Link>
            <Button variant="ghost" size="sm" onClick={() => void qry.refetch()} disabled={qry.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      >
        {qry.isError ? (
          <p className="text-sm text-red-400">{qry.error instanceof Error ? qry.error.message : 'Load failed'}</p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ForexMetricTile label="Open leads" value={snap?.funnel.open_leads ?? '—'} hint="Pipeline" />
              <ForexMetricTile label="Converted" value={snap?.funnel.converted_leads ?? '—'} hint="All time" />
              <ForexMetricTile label="Forex accounts" value={snap?.clients.forex_accounts ?? '—'} hint="Trading accounts" />
              <ForexMetricTile label="Open tasks" value={snap?.tasks.open ?? '—'} hint={`${snap?.tasks.overdue ?? 0} overdue`} />
            </div>
            {snap?.onboarding_bottlenecks.length ? (
              <p className="mb-3 text-xs text-amber-400/90">
                Onboarding bottlenecks:{' '}
                {snap.onboarding_bottlenecks.map((b) => `${b.label} (${b.open_count})`).join(' · ')}
              </p>
            ) : null}
            <p className="mb-2 text-xs text-admin-muted">
              Activities (7d): {snap?.activities_last_7d ?? 0} · Profiles: {snap?.clients.crm_profiles ?? 0} · Accounts with
              open positions: {snap?.clients.with_open_positions ?? 0}
            </p>
            <DataTable columns={columns} data={snap?.funnel.by_stage ?? []} loading={qry.isLoading} emptyMessage="No CRM stages." />
          </>
        )}
      </ForexPanelShell>

      <ForexPanelShell
        title="Recent operator activity"
        description="Unified CRM timeline — newest first"
        actions={
          <Button variant="ghost" size="sm" onClick={() => void activitiesQ.refetch()} disabled={activitiesQ.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${activitiesQ.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        {activitiesQ.isError ? (
          <p className="text-sm text-red-400">{activitiesQ.error instanceof Error ? activitiesQ.error.message : 'Load failed'}</p>
        ) : activitiesQ.isLoading ? (
          <p className="text-sm text-admin-muted">Loading timeline…</p>
        ) : !activitiesQ.data?.length ? (
          <p className="text-sm text-admin-muted">No recent CRM activities.</p>
        ) : (
          <ul className="space-y-2">
            {activitiesQ.data.map((row: ForexCrmRecentActivity) => (
              <li key={row.activity_id} className="flex flex-wrap items-start gap-2 rounded-md border border-admin-border/60 px-3 py-2 text-sm">
                <Badge variant="info" className="shrink-0 text-[10px] font-normal">
                  {activityKindLabel(row.kind)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.summary}</p>
                  <p className="text-[10px] text-admin-muted">
                    {new Date(row.created_at).toLocaleString()}
                    {row.account_id ? (
                      <>
                        {' · '}
                        <Link href={`/forex/crm/clients/${encodeURIComponent(row.account_id)}`} className="text-admin-accent hover:underline">
                          {row.account_id}
                        </Link>
                      </>
                    ) : null}
                    {row.lead_id ? ` · lead ${row.lead_id.slice(0, 8)}…` : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ForexPanelShell>
    </div>
  );
}
