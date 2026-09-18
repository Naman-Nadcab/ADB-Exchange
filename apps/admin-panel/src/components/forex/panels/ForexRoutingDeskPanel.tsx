'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminRoutingDesk, type ForexAdminSymbolRouteRow } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ArrowRight, RefreshCw } from 'lucide-react';

function StagingCheckRow(props: { label: string; pass: boolean; detail: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-admin-border/60 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs">{props.label}</span>
        <Badge variant={props.pass ? 'success' : 'warning'} className="font-normal text-[10px]">
          {props.pass ? 'Pass' : 'Pending'}
        </Badge>
      </div>
      <p className="text-xs text-admin-muted">{props.detail}</p>
    </div>
  );
}

function bookStatusBadge(status: string) {
  const u = status.toUpperCase();
  const variant =
    u === 'READY' ? 'success' : u === 'DEGRADED' ? 'warning' : u === 'HALTED' ? 'danger' : 'default';
  return (
    <Badge variant={variant} className="font-normal text-[10px]">
      {status}
    </Badge>
  );
}

export function ForexRoutingDeskPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const q = useQuery({
    queryKey: ['admin', 'forex', 'routing', 'desk', token],
    queryFn: async () => {
      const res = await getForexAdminRoutingDesk(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const symbolColumns = useMemo<ColumnDef<ForexAdminSymbolRouteRow>[]>(
    () => [
      { accessorKey: 'symbol', header: 'Symbol', cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
      {
        accessorKey: 'status',
        header: 'Book',
        cell: ({ getValue }) => bookStatusBadge(String(getValue())),
      },
      {
        accessorKey: 'selectedProvider',
        header: 'Selected LP',
        cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue() ?? '—')}</span>,
      },
      { accessorKey: 'selectedReason', header: 'Reason', cell: ({ getValue }) => <span className="text-xs">{String(getValue())}</span> },
      {
        id: 'health',
        header: 'Eligible / healthy',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">
            {row.original.eligibleProviderCount}/{row.original.healthyProviderCount} of {row.original.providerCount}
          </span>
        ),
      },
    ],
    [],
  );

  const data = q.data;

  return (
    <div className="admin-stack-lg">
      <ForexPanelShell
        title="Routing desk"
        description="Per-symbol MOCK LP selection snapshot. Rule edits remain on LP & Execution."
        actions={
          <Button type="button" size="sm" variant="ghost" onClick={() => void q.refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        {q.isLoading ? (
          <p className="text-sm text-admin-muted">Loading routing desk…</p>
        ) : q.isError ? (
          <p className="text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Load failed'}</p>
        ) : data ? (
          <>
            <ForexDetailGrid
              items={[
                {
                  label: 'FOREX_ROUTING_V2',
                  value: data.featureFlags.routingV2Enabled ? 'Enabled' : 'Off',
                  highlight: data.featureFlags.routingV2Enabled ? 'success' : 'default',
                },
                {
                  label: 'Adapter hook',
                  value: data.featureFlags.adapterLayerHookEnabled ? 'Enabled' : 'Off',
                  highlight: data.featureFlags.adapterLayerHookEnabled ? 'warning' : 'default',
                },
                { label: 'Default broker adapter', value: data.defaultBrokerAdapterId, mono: true },
                {
                  label: 'Adapter health',
                  value: data.brokerAdapterHealth?.status ?? 'unknown',
                  highlight:
                    data.brokerAdapterHealth?.status === 'connected'
                      ? 'success'
                      : data.brokerAdapterHealth?.status === 'degraded'
                        ? 'warning'
                        : 'default',
                },
              ]}
            />
            <Link
              href="/forex/lp-execution"
              className="mt-4 inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
            >
              Edit MOCK LP rules on LP & Execution
              <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        ) : null}
      </ForexPanelShell>

      {data?.stagingChecklist?.length ? (
        <ForexPanelShell title="S5 staging checklist" description="Enable env flags on staging only; prod defaults stay off.">
          <div className="grid gap-2 sm:grid-cols-2">
            {data.stagingChecklist.map((row) => (
              <StagingCheckRow key={row.id} label={row.label} pass={row.pass} detail={row.detail} />
            ))}
          </div>
        </ForexPanelShell>
      ) : null}

      {data ? (
        <ForexPanelShell title="Symbol routes" description="Live routing snapshot from the quote aggregator." noPadding>
          <DataTable columns={symbolColumns} data={data.symbolRoutes} />
        </ForexPanelShell>
      ) : null}

      {data?.notes?.length ? (
        <ForexPanelShell title="Notes">
          <ul className="list-disc space-y-1 pl-5 text-xs text-admin-muted">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </ForexPanelShell>
      ) : null}
    </div>
  );
}
