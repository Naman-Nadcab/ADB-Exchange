'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import {
  createForexAdminAccountGroup,
  getForexAdminAccountGroups,
  updateForexAdminAccountGroup,
  type ForexAdminAccountGroupRow,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { RefreshCw } from 'lucide-react';

export function ForexAccountGroupsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'account-groups', token],
    queryFn: async () => {
      const res = await getForexAdminAccountGroups(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data.groups;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await createForexAdminAccountGroup(token, { code: code.trim(), label: label.trim() });
      if (!res.success) throw new Error(res.error?.message ?? 'Create failed');
    },
    onSuccess: () => {
      setCode('');
      setLabel('');
      setFormError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'account-groups'] });
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Failed'),
  });

  const toggleMut = useMutation({
    mutationFn: async (row: ForexAdminAccountGroupRow) => {
      const res = await updateForexAdminAccountGroup(token, row.group_id, { is_active: !row.is_active });
      if (!res.success) throw new Error(res.error?.message ?? 'Update failed');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'account-groups'] }),
  });

  const columns = useMemo<ColumnDef<ForexAdminAccountGroupRow>[]>(
    () => [
      { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
      { accessorKey: 'label', header: 'Label' },
      {
        accessorKey: 'leverage_default',
        header: 'Leverage',
        cell: ({ row }) => <span className="text-xs">{row.original.leverage_default}:1</span>,
      },
      {
        accessorKey: 'position_mode_default',
        header: 'Mode',
        cell: ({ row }) => <span className="text-xs">{row.original.position_mode_default}</span>,
      },
      {
        accessorKey: 'account_count',
        header: 'Accounts',
        cell: ({ row }) => <span className="text-xs">{row.original.account_count}</span>,
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'success' : 'default'} className="text-[10px]">
            {row.original.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <ProtectedAction permission="forex:accounts:manage" fallback="hidden">
            <Button size="sm" variant="ghost" disabled={toggleMut.isPending} onClick={() => void toggleMut.mutate(row.original)}>
              {row.original.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </ProtectedAction>
        ),
      },
    ],
    [toggleMut.isPending],
  );

  return (
    <ForexPanelShell
      title="Account groups"
      description="Group policy profiles (JSON) persist in DB; margin engine may not consume all fields yet."
      actions={
        <Button variant="ghost" size="sm" onClick={() => void qry.refetch()} disabled={qry.isFetching}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <ProtectedAction permission="forex:accounts:manage" fallback="hidden">
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-admin-border/60 bg-admin-surface/40 p-3">
          <Input placeholder="Code (e.g. RETAIL_STD)" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[160px]" />
          <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="max-w-[220px]" />
          <Button size="sm" disabled={createMut.isPending || !code.trim() || !label.trim()} onClick={() => void createMut.mutate()}>
            Create group
          </Button>
          {formError ? <span className="text-xs text-red-400">{formError}</span> : null}
        </div>
      </ProtectedAction>

      {qry.isError ? (
        <p className="text-sm text-red-400">{qry.error instanceof Error ? qry.error.message : 'Load failed'}</p>
      ) : (
        <DataTable columns={columns} data={qry.data ?? []} loading={qry.isLoading} emptyMessage="No account groups defined." />
      )}
    </ForexPanelShell>
  );
}
