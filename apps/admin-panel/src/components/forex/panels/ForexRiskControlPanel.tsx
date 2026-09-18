'use client';

import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminRiskControlSnapshot } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';

type FieldRow = {
  key: string;
  label: string;
  current_value: unknown;
  source: string;
  engine_applied: boolean;
  last_changed: string;
};

export function ForexRiskControlPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'risk-control', token],
    queryFn: async () => {
      const res = await getForexAdminRiskControlSnapshot(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const columns = useMemo<ColumnDef<FieldRow>[]>(
    () => [
      { accessorKey: 'label', header: 'Control' },
      {
        accessorKey: 'current_value',
        header: 'Effective value',
        cell: ({ row }) => {
          const v = row.original.current_value;
          const text =
            v == null ? '—' : typeof v === 'object' ? Object.entries(v as Record<string, unknown>).map(([k, val]) => `${k}: ${String(val)}`).join(' · ') : String(v);
          return <span className="text-xs text-admin-foreground">{text}</span>;
        },
      },
      { accessorKey: 'source', header: 'Source', cell: ({ row }) => <span className="text-xs">{row.original.source}</span> },
      {
        accessorKey: 'engine_applied',
        header: 'Runtime',
        cell: ({ row }) => (
          <Badge variant={row.original.engine_applied ? 'success' : 'warning'} className="text-[10px]">
            {row.original.engine_applied ? 'ENGINE-APPLIED' : 'PERSISTED ONLY'}
          </Badge>
        ),
      },
    ],
    [],
  );

  const snap = qry.data;

  return (
    <ForexPanelShell
      title="Risk control plane"
      description="Read-only effective state · no parallel risk engine"
      actions={
        <Button variant="ghost" size="sm" onClick={() => void qry.refetch()} disabled={qry.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      }
    >
      {snap ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <Badge variant={snap.posture.kill_switch ? 'danger' : 'default'}>Kill: {String(snap.posture.kill_switch)}</Badge>
          <Badge variant="default">REAL_FOREX: {String(snap.posture.real_forex)}</Badge>
          <Badge variant={snap.posture.economic_ready ? 'success' : 'warning'}>
            Economic ready: {String(snap.posture.economic_ready)}
          </Badge>
        </div>
      ) : null}
      {snap?.note ? <p className="mb-3 text-xs text-admin-muted">{snap.note}</p> : null}
      {qry.isError ? (
        <p className="text-sm text-red-400">{qry.error instanceof Error ? qry.error.message : 'Load failed'}</p>
      ) : (
        <DataTable columns={columns} data={snap?.fields ?? []} loading={qry.isLoading} emptyMessage="No controls." />
      )}
    </ForexPanelShell>
  );
}
