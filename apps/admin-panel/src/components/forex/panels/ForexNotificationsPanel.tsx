'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminNotifications,
  postForexNotificationAcknowledge,
  postForexNotificationResolve,
  type ForexAdminNotificationRow,
} from '@/lib/admin/forex-api';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import { ForexFilterBar, ForexSectionLabel, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { cn } from '@/lib/cn';
import { Bell, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

function fmtTime(s: string): string {
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return s;
  }
}

export function ForexNotificationsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const q = useQuery({
    queryKey: ['admin', 'forex', 'notifications', token, page, unresolvedOnly],
    queryFn: async () => {
      const res = await getForexAdminNotifications(token, { page, unresolved_only: unresolvedOnly });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 20_000,
  });

  const ackM = useMutation({
    mutationFn: (id: string) => postForexNotificationAcknowledge(token, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'notifications'] }),
  });

  const resolveM = useMutation({
    mutationFn: (id: string) => postForexNotificationResolve(token, id, 'Resolved by operator'),
    onSuccess: () => {
      setResolveId(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'notifications'] });
    },
  });

  const rows = q.data?.rows ?? [];
  const filteredRows = useMemo(() => {
    if (severityFilter === 'all') return rows;
    return rows.filter((r) => r.severity === severityFilter);
  }, [rows, severityFilter]);

  const pageStats = useMemo(() => {
    let open = 0;
    let critical = 0;
    for (const r of rows) {
      if (!r.resolved_at) open += 1;
      if (r.severity === 'critical' && !r.resolved_at) critical += 1;
    }
    return { open, critical, total: q.data?.pagination.total ?? rows.length };
  }, [rows, q.data?.pagination.total]);

  const columns = useMemo<ColumnDef<ForexAdminNotificationRow>[]>(
    () => [
      { accessorKey: 'created_at', header: 'When', cell: ({ getValue }) => <span className="whitespace-nowrap text-[10px] tabular-nums">{fmtTime(String(getValue()))}</span> },
      { accessorKey: 'category', header: 'Domain', cell: ({ getValue }) => <Badge variant="info" className="text-[9px] font-normal uppercase">{String(getValue())}</Badge> },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => (
          <Badge variant={row.original.severity === 'critical' ? 'danger' : row.original.severity === 'high' ? 'warning' : 'default'} className="text-[9px] font-normal capitalize">
            {row.original.severity}
          </Badge>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Alert',
        cell: ({ row }) => (
          <div className="max-w-md">
            <p className="text-sm font-medium">{row.original.title}</p>
            {row.original.body ? <p className="line-clamp-1 text-[10px] text-admin-muted">{row.original.body}</p> : null}
          </div>
        ),
      },
      {
        id: 'state',
        header: 'State',
        cell: ({ row }) => {
          const state = row.original.resolved_at ? 'Resolved' : row.original.acknowledged_at ? 'Acknowledged' : 'Open';
          return (
            <Badge variant={state === 'Open' ? 'warning' : state === 'Resolved' ? 'success' : 'default'} className="text-[9px] font-normal">
              {state}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            {!row.original.acknowledged_at ? (
              <ProtectedAction permission="forex:view" fallback="disabled">
                <Button type="button" size="sm" variant="secondary" className="h-7 text-[10px]" disabled={ackM.isPending} onClick={() => ackM.mutate(row.original.notification_id)}>
                  Ack
                </Button>
              </ProtectedAction>
            ) : null}
            {!row.original.resolved_at ? (
              <ProtectedAction permission="forex:controls:manage" fallback="disabled">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setResolveId(row.original.notification_id)}>
                  Resolve
                </Button>
              </ProtectedAction>
            ) : null}
          </div>
        ),
      },
    ],
    [ackM.isPending],
  );

  const pagination = q.data?.pagination;

  return (
    <div className="space-y-4">
      <ForexWorkspaceHeader
        title="Alerts & notifications"
        purpose="Cross-desk operator alerts — acknowledge and resolve with audit."
        dataSource="forex_operator_notifications"
        posture="MOCK"
        kpis={[
          { label: 'In scope (total)', value: String(pageStats.total) },
          { label: 'Open (this page)', value: String(pageStats.open) },
          { label: 'Critical (page)', value: String(pageStats.critical), tone: pageStats.critical > 0 ? 'danger' : undefined },
          { label: 'Filter', value: unresolvedOnly ? 'Unresolved' : 'All' },
        ]}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Total matching" value={String(pageStats.total)} />
        <StatChip label="Open on page" value={String(pageStats.open)} highlight={pageStats.open > 0} />
        <StatChip label="Critical on page" value={String(pageStats.critical)} warn={pageStats.critical > 0} />
        <StatChip label="Page" value={pagination ? `${pagination.page}/${Math.max(1, pagination.totalPages)}` : '—'} />
      </div>

      <ForexWorkspaceSurface noPadding>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-4 py-3">
          <ForexSectionLabel icon={Bell}>Alert queue</ForexSectionLabel>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => void q.refetch()}>
            <RefreshCw className={cn('h-3.5 w-3.5', q.isFetching && 'animate-spin')} />
          </Button>
        </div>
        <div className="border-b border-admin-border/60 px-4 py-2">
          <ForexFilterBar className="border-0 bg-transparent p-0">
            <label className="flex items-center gap-2 text-xs text-admin-muted">
              <input type="checkbox" checked={unresolvedOnly} onChange={(e) => { setUnresolvedOnly(e.target.checked); setPage(1); }} />
              Unresolved only
            </label>
            {(['all', 'critical', 'high', 'medium', 'info'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverityFilter(s)}
                className={cn(
                  'rounded-md px-2 py-1 text-[10px] font-medium uppercase',
                  severityFilter === s ? 'bg-violet-500/20 text-violet-200' : 'text-admin-muted hover:bg-white/5',
                )}
              >
                {s}
              </button>
            ))}
          </ForexFilterBar>
        </div>
        {q.isError ? (
          <p className="p-4 text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Failed'}</p>
        ) : (
          <DataTable columns={columns} data={filteredRows} loading={q.isLoading} compact emptyMessage="No notifications match filters." />
        )}
        {pagination ? (
          <div className="flex items-center justify-between border-t border-admin-border px-4 py-2 text-xs text-admin-muted">
            <span>
              Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.total} total
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={pagination.totalPages > 0 && page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </ForexWorkspaceSurface>

      <ForexConfirmModal
        open={!!resolveId}
        title="Resolve notification"
        description="Marks alert resolved — audited under forex:controls:manage."
        confirmLabel="Resolve"
        onClose={() => setResolveId(null)}
        loading={resolveM.isPending}
        onConfirm={async () => {
          if (resolveId) resolveM.mutate(resolveId);
        }}
      />
    </div>
  );
}

function StatChip(props: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-admin-border/60 bg-admin-bg/30 px-3 py-2">
      <p className="text-[9px] uppercase tracking-wide text-admin-muted">{props.label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', props.warn && 'text-red-400', props.highlight && !props.warn && 'text-amber-300')}>{props.value}</p>
    </div>
  );
}
