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
  const [profileGroup, setProfileGroup] = useState('');
  const [profileRate, setProfileRate] = useState('');
  const [profileLong, setProfileLong] = useState('');
  const [profileShort, setProfileShort] = useState('');
  const [profileSpread, setProfileSpread] = useState('');
  const [profileLeverage, setProfileLeverage] = useState('');
  const [profileMode, setProfileMode] = useState('');
  const [profileMaxOrder, setProfileMaxOrder] = useState('');
  const [profileMaxPositions, setProfileMaxPositions] = useState('');
  const [createLeverage, setCreateLeverage] = useState('');
  const [createMode, setCreateMode] = useState('HEDGING');

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
      const res = await createForexAdminAccountGroup(token, {
        code: code.trim(),
        label: label.trim(),
        ...(createLeverage.trim() ? { leverage_default: createLeverage.trim() } : {}),
        position_mode_default: createMode,
      });
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

  const profileMut = useMutation({
    mutationFn: async () => {
      const res = await updateForexAdminAccountGroup(token, profileGroup, {
        commission_profile: profileRate.trim() ? { model: 'per_lot', rate: profileRate.trim() } : undefined,
        swap_profile: profileLong.trim() || profileShort.trim() ? { longSwap: profileLong.trim() || undefined, shortSwap: profileShort.trim() || undefined } : undefined,
        spread_profile: profileSpread.trim() ? { maxSpread: profileSpread.trim() } : undefined,
        ...(profileLeverage.trim() ? { leverage_default: profileLeverage.trim() } : {}),
        ...(profileMode === 'NETTING' || profileMode === 'HEDGING' ? { position_mode_default: profileMode } : {}),
        risk_profile: {
          maxOrderVolume: profileMaxOrder.trim() || null,
          maxOpenPositions: profileMaxPositions.trim() || null,
        },
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Profile update failed');
    },
    onSuccess: () => {
      setFormError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'account-groups'] });
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Failed'),
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
      description="Commission, swap, max spread, leverage, position mode, and risk limits apply to accounts in the group."
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
          <Input placeholder="Leverage" value={createLeverage} onChange={(e) => setCreateLeverage(e.target.value)} className="max-w-[100px]" />
          <select value={createMode} onChange={(e) => setCreateMode(e.target.value)} className="h-9 rounded border border-admin-border bg-admin-bg px-2 text-xs">
            <option value="HEDGING">HEDGING</option>
            <option value="NETTING">NETTING</option>
          </select>
          <Button size="sm" disabled={createMut.isPending || !code.trim() || !label.trim()} onClick={() => void createMut.mutate()}>
            Create group
          </Button>
          {formError ? <span className="text-xs text-red-400">{formError}</span> : null}
        </div>
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-admin-border/60 bg-admin-surface/40 p-3">
          <select value={profileGroup} onChange={(e) => setProfileGroup(e.target.value)} className="h-9 max-w-[180px] rounded border border-admin-border bg-admin-bg px-2 text-xs">
            <option value="">Group profile…</option>
            {(qry.data ?? []).map((g) => (
              <option key={g.group_id} value={g.group_id}>{g.code}</option>
            ))}
          </select>
          <Input placeholder="Commission / lot" value={profileRate} onChange={(e) => setProfileRate(e.target.value)} className="max-w-[140px]" />
          <Input placeholder="Swap long" value={profileLong} onChange={(e) => setProfileLong(e.target.value)} className="max-w-[120px]" />
          <Input placeholder="Swap short" value={profileShort} onChange={(e) => setProfileShort(e.target.value)} className="max-w-[120px]" />
          <Input placeholder="Max spread" value={profileSpread} onChange={(e) => setProfileSpread(e.target.value)} className="max-w-[120px]" />
          <Input placeholder="Leverage" value={profileLeverage} onChange={(e) => setProfileLeverage(e.target.value)} className="max-w-[100px]" />
          <select value={profileMode} onChange={(e) => setProfileMode(e.target.value)} className="h-9 rounded border border-admin-border bg-admin-bg px-2 text-xs">
            <option value="">Mode…</option>
            <option value="HEDGING">HEDGING</option>
            <option value="NETTING">NETTING</option>
          </select>
          <Input placeholder="Max order volume" value={profileMaxOrder} onChange={(e) => setProfileMaxOrder(e.target.value)} className="max-w-[150px]" />
          <Input placeholder="Max open positions" value={profileMaxPositions} onChange={(e) => setProfileMaxPositions(e.target.value)} className="max-w-[160px]" />
          <Button size="sm" disabled={profileMut.isPending || !profileGroup} onClick={() => void profileMut.mutate()}>
            Save profile
          </Button>
          <p className="w-full text-[11px] text-admin-muted">A blank max order volume or max open positions clears that limit on the accounts in this group.</p>
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
