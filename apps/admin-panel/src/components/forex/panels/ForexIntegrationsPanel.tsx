'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminIntegrations } from '@/lib/admin/forex-api';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import type { ForexAdminProviderCatalogRow } from '@/lib/admin/forex-api';
import { ArrowRight, Cable } from 'lucide-react';

function statusBadge(status: string) {
  const u = status.toUpperCase();
  const variant =
    u === 'CONNECTED'
      ? 'success'
      : u === 'DEGRADED'
        ? 'warning'
        : u === 'DISABLED'
          ? 'default'
          : u === 'NOT_CONFIGURED'
            ? 'default'
            : 'danger';
  return (
    <Badge variant={variant} className="font-normal text-[10px]">
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export function ForexIntegrationsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const q = useQuery({
    queryKey: ['admin', 'forex', 'integrations', token],
    queryFn: async () => {
      const res = await getForexAdminIntegrations(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const columns = useMemo<ColumnDef<ForexAdminProviderCatalogRow>[]>(
    () => [
      { accessorKey: 'displayName', header: 'Provider' },
      { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
      { accessorKey: 'protocol', header: 'Protocol' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => statusBadge(String(getValue())),
      },
      {
        accessorKey: 'isDefault',
        header: 'Default',
        cell: ({ getValue }) => (getValue() ? <Badge variant="info">Default</Badge> : '—'),
      },
      {
        accessorKey: 'capabilities',
        header: 'Capabilities',
        cell: ({ row }) => (
          <span className="text-xs text-admin-muted">{row.original.capabilities.slice(0, 4).join(', ')}</span>
        ),
      },
    ],
    [],
  );

  const data = q.data;

  return (
    <div className="admin-stack-lg">
      <ForexPanelShell
        title="Adapter layer"
        description="Provider-agnostic execution. The internal Forex adapter is active. External brokers stay as catalog placeholders until an adapter is certified."
      >
        {q.isLoading ? (
          <p className="text-sm text-admin-muted">Loading integration catalog…</p>
        ) : q.isError ? (
          <p className="text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Load failed'}</p>
        ) : data ? (
          <ForexDetailGrid
            items={[
              { label: 'Default adapter', value: data.defaultAdapterId, mono: true },
              { label: 'Catalog version', value: data.adapterLayerVersion, mono: true },
              { label: 'Execution mode', value: data.posture.executionMode, highlight: 'warning' },
              { label: 'Live money path', value: data.posture.realForex ? 'Armed' : 'Blocked', highlight: data.posture.realForex ? 'danger' : 'success' },
            ]}
          />
        ) : null}
      </ForexPanelShell>

      {data ? (
        <ForexPanelShell title="Broker & LP catalog" description="No credentials are shown here." noPadding>
          <DataTable columns={columns} data={data.providers} compact sortable={false} />
        </ForexPanelShell>
      ) : null}

      {data?.notes?.length ? (
        <ForexPanelShell title="Operator notes">
          <ul className="list-inside list-disc space-y-1 text-sm text-admin-muted">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </ForexPanelShell>
      ) : null}

      {data ? (
        <ForexPanelShell
          title="MOCK liquidity providers (execution)"
          description="Simulated LPs used by the internal venue — configure routing under Liquidity."
          actions={
            <Link href="/forex/lp-execution">
              <Button type="button" variant="secondary" size="sm" className="gap-1">
                <Cable className="h-3.5 w-3.5" />
                LP & execution
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        >
          <div className="flex flex-wrap gap-2">
            {data.executionProviders.map((p) => (
              <Badge key={p.providerId} variant="warning" className="font-normal">
                {p.providerCode}: {p.health?.status ?? 'unknown'}
              </Badge>
            ))}
          </div>
        </ForexPanelShell>
      ) : null}
    </div>
  );
}
