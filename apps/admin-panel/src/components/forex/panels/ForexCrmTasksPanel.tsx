'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import {
  completeForexAdminCrmTask,
  getForexAdminCrmTasks,
  postForexAdminCrmTask,
  type ForexAdminCrmTaskRow,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { RefreshCw } from 'lucide-react';

export function ForexCrmTasksPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [title, setTitle] = useState('');
  const [leadId, setLeadId] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'tasks', token, page, status, overdueOnly],
    queryFn: async () => {
      const res = await getForexAdminCrmTasks(token, {
        page,
        status: status || undefined,
        overdue: overdueOnly ? true : undefined,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await postForexAdminCrmTask(token, {
        title: title.trim(),
        lead_id: leadId.trim() || undefined,
        task_type: 'FOLLOW_UP',
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Create failed');
    },
    onSuccess: () => {
      setTitle('');
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'crm', 'tasks'] });
    },
  });

  const completeMut = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await completeForexAdminCrmTask(token, taskId);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'crm', 'tasks'] }),
  });

  const columns = useMemo<ColumnDef<ForexAdminCrmTaskRow>[]>(
    () => [
      { accessorKey: 'title', header: 'Task' },
      { accessorKey: 'task_type', header: 'Type', cell: ({ row }) => <span className="text-xs">{row.original.task_type}</span> },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'done' ? 'success' : 'default'} className="text-[10px] capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'due_at',
        header: 'Due',
        cell: ({ row }) => (
          <span className="text-xs text-admin-muted">
            {row.original.due_at ? new Date(row.original.due_at).toLocaleString() : '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          row.original.status !== 'done' ? (
            <ProtectedAction permission="forex:crm:manage" fallback="hidden">
              <Button size="sm" variant="ghost" disabled={completeMut.isPending} onClick={() => completeMut.mutate(row.original.task_id)}>
                Complete
              </Button>
            </ProtectedAction>
          ) : null,
      },
    ],
    [completeMut.isPending],
  );

  const pagination = qry.data?.pagination;

  return (
    <ForexPanelShell
      title="CRM tasks"
      description="Operational follow-ups — no outbound comms from this panel."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void qry.refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      }
    >
      <ProtectedAction permission="forex:crm:manage" fallback="hidden">
        <div className="mb-4 flex flex-wrap gap-2">
          <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-[200px]" />
          <Input placeholder="Lead ID (optional)" value={leadId} onChange={(e) => setLeadId(e.target.value)} className="max-w-[280px] font-mono text-xs" />
          <Button size="sm" disabled={createMut.isPending || title.trim().length < 2} onClick={() => createMut.mutate()}>
            Create task
          </Button>
        </div>
      </ProtectedAction>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-admin-border bg-admin-surface px-2 py-1.5 text-xs"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="open">open</option>
          <option value="in_progress">in_progress</option>
          <option value="done">done</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-admin-muted">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => {
              setOverdueOnly(e.target.checked);
              setPage(1);
            }}
          />
          Overdue only
        </label>
      </div>
      <DataTable columns={columns} data={qry.data?.rows ?? []} emptyMessage="No tasks." />
      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-3 flex justify-end gap-2 text-xs">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="ghost" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </ForexPanelShell>
  );
}
