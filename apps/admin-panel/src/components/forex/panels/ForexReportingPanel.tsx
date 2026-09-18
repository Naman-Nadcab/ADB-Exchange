'use client';

import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminReportingSnapshot,
  type ForexAdminReportCategory,
  type ForexAdminReportMetric,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Tabs } from '@/components/ui/Tabs';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexMetricTile } from '@/components/forex/primitives/ForexMetricTile';

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const REPORT_TABS: { id: ForexAdminReportCategory; label: string }[] = [
  { id: 'executive', label: 'Executive' },
  { id: 'trading', label: 'Trading' },
  { id: 'clients', label: 'Clients' },
  { id: 'risk', label: 'Risk' },
  { id: 'finance', label: 'Finance' },
  { id: 'partners', label: 'Partners' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'audit', label: 'Audit' },
];

export function ForexReportingPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [range, setRange] = useState(defaultRange);
  const [category, setCategory] = useState<ForexAdminReportCategory>('executive');

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'reporting', token, range.from, range.to],
    queryFn: async () => {
      const res = await getForexAdminReportingSnapshot(token, {
        from: `${range.from}T00:00:00.000Z`,
        to: `${range.to}T23:59:59.999Z`,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && !!range.from && !!range.to,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const all = qry.data?.metrics ?? [];
    return all.filter((m) => (m.category ?? 'executive') === category);
  }, [qry.data?.metrics, category]);

  const columns = useMemo<ColumnDef<ForexAdminReportMetric>[]>(
    () => [
      { accessorKey: 'label', header: 'Metric' },
      {
        accessorKey: 'value',
        header: 'Value',
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.status === 'NOT_AVAILABLE' || row.original.value == null ? 'NOT AVAILABLE' : String(row.original.value)}
          </span>
        ),
      },
      { accessorKey: 'source', header: 'Source', cell: ({ row }) => <span className="text-xs">{row.original.source}</span> },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'VERIFIED' ? 'success' : 'default'} className="text-[10px]">
            {row.original.status}
          </Badge>
        ),
      },
    ],
    [],
  );

  const snap = qry.data;
  const topMetrics = filtered.slice(0, 4);

  return (
    <ForexPanelShell
      title="Forex reporting"
      description="Operational BI · aggregates from PostgreSQL only"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-admin-muted">
            From
            <input
              type="date"
              className="rounded border border-admin-border bg-admin-surface px-2 py-1 text-xs text-admin-fg"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-admin-muted">
            To
            <input
              type="date"
              className="rounded border border-admin-border bg-admin-surface px-2 py-1 text-xs text-admin-fg"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </label>
          <Button variant="ghost" size="sm" onClick={() => void qry.refetch()} disabled={qry.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      {snap ? (
        <p className="mb-3 text-xs text-admin-muted">
          TIME RANGE: {snap.time_range.label} ({new Date(snap.time_range.from).toLocaleString()} →{' '}
          {new Date(snap.time_range.to).toLocaleString()}) · {snap.note}
        </p>
      ) : null}
      <Tabs
        className="mb-4"
        active={category}
        onChange={setCategory}
        items={REPORT_TABS}
        size="sm"
      />
      {topMetrics.length > 0 ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topMetrics.map((m) => (
            <ForexMetricTile
              key={m.id}
              label={m.label}
              value={m.status === 'VERIFIED' && m.value != null ? String(m.value) : 'N/A'}
              hint={m.source}
            />
          ))}
        </div>
      ) : null}
      {qry.isError ? (
        <p className="text-sm text-red-400">{qry.error instanceof Error ? qry.error.message : 'Load failed'}</p>
      ) : (
        <DataTable columns={columns} data={filtered} loading={qry.isLoading} emptyMessage="No metrics in this view." />
      )}
    </ForexPanelShell>
  );
}
