'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminTradingAccounts, type ForexAdminTradingAccountRow } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';

function fmtTime(iso: string | null): string {
  if (!iso || iso === 'epoch') return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function ForexTradingAccountsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [page, setPage] = useState(1);
  const [draftQ, setDraftQ] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'accounts', 'list', token, page, q, status],
    queryFn: async () => {
      const res = await getForexAdminTradingAccounts(token, {
        page,
        limit: 25,
        q: q || undefined,
        status: status || undefined,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const columns = useMemo<ColumnDef<ForexAdminTradingAccountRow>[]>(
    () => [
      {
        accessorKey: 'account_id',
        header: 'Account',
        cell: ({ row }) => (
          <Link href={`/forex/crm/clients/${encodeURIComponent(row.original.account_id)}`} className="font-mono text-xs text-violet-400 hover:underline">
            {row.original.account_id}
          </Link>
        ),
      },
      { accessorKey: 'user_id', header: 'User', cell: ({ getValue }) => <span className="font-mono text-[10px] text-admin-muted">{String(getValue() ?? '—')}</span> },
      { accessorKey: 'group_code', header: 'Group', cell: ({ getValue }) => getValue() ?? '—' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status.toUpperCase() === 'ACTIVE' ? 'success' : 'warning'} className="font-normal capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      { accessorKey: 'customer_cash_balance', header: 'Balance', cell: ({ getValue }) => <span className="tabular-nums font-medium">{String(getValue())}</span> },
      { accessorKey: 'open_positions', header: 'Positions' },
      { accessorKey: 'open_orders', header: 'Orders' },
      { accessorKey: 'leverage_default', header: 'Lev', cell: ({ getValue }) => (getValue() ? `${getValue()}×` : '—') },
      { accessorKey: 'last_activity_at', header: 'Last activity', cell: ({ getValue }) => fmtTime(getValue() as string | null) },
      {
        id: 'drill',
        header: '',
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Link href={`/forex/positions?account_id=${encodeURIComponent(row.original.account_id)}`}>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
                Positions
              </Button>
            </Link>
            <Link href={`/forex/orders?account_id=${encodeURIComponent(row.original.account_id)}`}>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
                Orders
              </Button>
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  const pagination = qry.data?.pagination;

  const rows = qry.data?.rows ?? [];
  const withPositions = rows.filter((r) => r.open_positions > 0).length;

  return (
    <div className="space-y-4">
      <ForexWorkspaceHeader
        title="Trading account operations"
        purpose="Search accounts, balances, open orders/positions, and drill to Client 360 or trading desks."
        dataSource="forex_accounts + CUSTOMER_CASH ledger"
        posture="MOCK"
        kpis={[
          { label: 'On page', value: String(rows.length) },
          { label: 'With open positions', value: String(withPositions) },
          { label: 'Total (filter)', value: String(pagination?.total ?? '—') },
        ]}
      />
      <ForexPanelShell
        title="Trading accounts"
        description={qry.data?.note ?? 'Operational account registry — balances from isolated Forex ledger'}
        actions={
          <Button type="button" size="sm" variant="ghost" onClick={() => void qry.refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-admin-muted">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-admin-muted" />
              <Input className="h-9 pl-8" placeholder="Account or user id" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-admin-muted">Status</label>
            <select
              className="h-9 rounded-md border border-admin-border bg-admin-bg px-2 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-9"
            onClick={() => {
              setQ(draftQ.trim());
              setPage(1);
            }}
          >
            Apply
          </Button>
        </div>
        {qry.isError ? (
          <p className="text-sm text-red-400">{qry.error instanceof Error ? qry.error.message : 'Load failed'}</p>
        ) : (
          <DataTable columns={columns} data={qry.data?.rows ?? []} loading={qry.isLoading} compact sortable emptyMessage="No accounts match filters." />
        )}
      </ForexPanelShell>

      {pagination ? (
        <div className="flex items-center justify-between text-sm text-admin-muted">
          <span>
            Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.total} accounts
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

      <p className="text-xs text-admin-muted">
        <ExternalLink className="mr-1 inline h-3 w-3" />
        Ledger entries and reconciliation events live under Finance → Ledger.
      </p>
    </div>
  );
}
