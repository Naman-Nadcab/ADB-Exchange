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
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

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

  const columns = useMemo<ColumnDef<ForexAdminNotificationRow>[]>(
    () => [
      { accessorKey: 'created_at', header: 'When', cell: ({ getValue }) => fmtTime(String(getValue())) },
      { accessorKey: 'category', header: 'Category', cell: ({ getValue }) => <Badge variant="info" className="font-normal">{String(getValue())}</Badge> },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => (
          <Badge variant={row.original.severity === 'critical' ? 'danger' : row.original.severity === 'high' ? 'warning' : 'default'} className="font-normal capitalize">
            {row.original.severity}
          </Badge>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Alert',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.title}</p>
            {row.original.body ? <p className="text-xs text-admin-muted line-clamp-2">{row.original.body}</p> : null}
          </div>
        ),
      },
      {
        id: 'state',
        header: 'State',
        cell: ({ row }) => (
          <span className="text-xs text-admin-muted">
            {row.original.resolved_at ? 'Resolved' : row.original.acknowledged_at ? 'Acknowledged' : 'Open'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-1">
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
    <>
      <ForexPanelShell
        title="Operator notifications"
        description="Cross-desk alerts — acknowledge (view) and resolve (controls manage)"
        actions={
          <Button size="sm" variant="ghost" onClick={() => void q.refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
        noPadding
      >
        <div className="border-b border-admin-border p-3">
          <label className="flex items-center gap-2 text-xs text-admin-muted">
            <input type="checkbox" checked={unresolvedOnly} onChange={(e) => { setUnresolvedOnly(e.target.checked); setPage(1); }} />
            Unresolved only
          </label>
        </div>
        {q.isError ? (
          <p className="p-4 text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Failed'}</p>
        ) : (
          <DataTable columns={columns} data={q.data?.rows ?? []} loading={q.isLoading} compact emptyMessage="No notifications match filters." />
        )}
      </ForexPanelShell>

      {pagination ? (
        <div className="mt-3 flex items-center justify-between text-sm text-admin-muted">
          <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
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
    </>
  );
}
