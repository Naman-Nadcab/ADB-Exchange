'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminExecutions,
  getForexAdminOrders,
  getForexAdminPositions,
  type ForexAdminExecutionRow,
  type ForexAdminOrderRow,
  type ForexAdminPositionRow,
} from '@/lib/admin/forex-api';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export type ForexOpsTableKind = 'orders' | 'executions' | 'positions';

const PAGE_SIZE = 25;

function fmtTime(s: string): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return s;
  }
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

function StatusBadge({ status }: { status: string }) {
  const u = status.toUpperCase();
  const variant =
    u === 'FILLED' || u === 'OPEN'
      ? 'success'
      : u === 'REJECTED' || u === 'FAILED' || u === 'CANCELLED'
        ? 'danger'
        : u === 'PARTIALLY_FILLED'
          ? 'info'
          : 'warning';
  return (
    <Badge variant={variant} className="font-mono text-[10px] font-normal">
      {status}
    </Badge>
  );
}

function SideBadge({ side }: { side: string }) {
  const buyish = side === 'buy' || side === 'long';
  return (
    <span className={buyish ? 'text-emerald-400' : 'text-red-400'}>{side.toUpperCase()}</span>
  );
}

export function ForexAdminOpsTable({ kind }: { kind: ForexOpsTableKind }) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [page, setPage] = useState(1);
  const [symbol, setSymbol] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('all');
  const [side, setSide] = useState('all');
  const [draftSymbol, setDraftSymbol] = useState('');
  const [draftAccount, setDraftAccount] = useState('');

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      symbol: symbol || undefined,
      account_id: accountId || undefined,
      status: status === 'all' ? undefined : status,
      side: side === 'all' ? undefined : side,
    }),
    [page, symbol, accountId, status, side],
  );

  const listQ = useQuery({
    queryKey: ['admin', 'forex', kind, token, queryParams],
    queryFn: async () => {
      const fetcher =
        kind === 'orders'
          ? getForexAdminOrders
          : kind === 'executions'
            ? getForexAdminExecutions
            : getForexAdminPositions;
      const res = await fetcher(token, queryParams);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'List failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const orderColumns = useMemo<ColumnDef<ForexAdminOrderRow>[]>(
    () => [
      { accessorKey: 'created_at', header: 'Time', cell: ({ getValue }) => fmtTime(String(getValue())) },
      { accessorKey: 'symbol', header: 'Symbol' },
      { accessorKey: 'side', header: 'Side', cell: ({ getValue }) => <SideBadge side={String(getValue())} /> },
      { accessorKey: 'order_type', header: 'Type' },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
      { accessorKey: 'requested_volume', header: 'Vol' },
      { accessorKey: 'filled_volume', header: 'Filled' },
      { accessorKey: 'account_id', header: 'Account', cell: ({ getValue }) => shortId(String(getValue())) },
      { accessorKey: 'order_id', header: 'Order', cell: ({ getValue }) => <span className="font-mono text-xs">{shortId(String(getValue()))}</span> },
    ],
    [],
  );

  const execColumns = useMemo<ColumnDef<ForexAdminExecutionRow>[]>(
    () => [
      { accessorKey: 'created_at', header: 'Time', cell: ({ getValue }) => fmtTime(String(getValue())) },
      { accessorKey: 'symbol', header: 'Symbol' },
      { accessorKey: 'side', header: 'Side', cell: ({ getValue }) => <SideBadge side={String(getValue())} /> },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
      { accessorKey: 'volume', header: 'Vol' },
      { accessorKey: 'execution_price', header: 'Price', cell: ({ getValue }) => getValue() ?? '—' },
      { accessorKey: 'selected_provider', header: 'Provider', cell: ({ getValue }) => getValue() ?? '—' },
      { accessorKey: 'account_id', header: 'Account', cell: ({ getValue }) => (getValue() ? shortId(String(getValue())) : '—') },
      { accessorKey: 'execution_id', header: 'Exec', cell: ({ getValue }) => <span className="font-mono text-xs">{shortId(String(getValue()))}</span> },
    ],
    [],
  );

  const posColumns = useMemo<ColumnDef<ForexAdminPositionRow>[]>(
    () => [
      { accessorKey: 'updated_at', header: 'Updated', cell: ({ getValue }) => fmtTime(String(getValue())) },
      { accessorKey: 'symbol', header: 'Symbol' },
      { accessorKey: 'side', header: 'Side', cell: ({ getValue }) => <SideBadge side={String(getValue())} /> },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
      { accessorKey: 'mode', header: 'Mode' },
      { accessorKey: 'volume', header: 'Vol' },
      { accessorKey: 'entry_price', header: 'Entry' },
      { accessorKey: 'current_price', header: 'Mark' },
      { accessorKey: 'leverage', header: 'Lev' },
      { accessorKey: 'account_id', header: 'Account', cell: ({ getValue }) => shortId(String(getValue())) },
    ],
    [],
  );

  const pagination = listQ.data?.pagination;
  const rows = listQ.data?.rows ?? [];

  const statusOptions =
    kind === 'positions'
      ? [
          { value: 'all', label: 'All' },
          { value: 'OPEN', label: 'Open' },
          { value: 'CLOSED', label: 'Closed' },
        ]
      : [
          { value: 'all', label: 'All' },
          { value: 'OPEN', label: 'Open (non-terminal)' },
          { value: 'FILLED', label: 'Filled' },
          { value: 'CANCELLED', label: 'Cancelled' },
          { value: 'REJECTED', label: 'Rejected' },
        ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-violet-500/20 bg-admin-card/50 p-3">
        <div className="min-w-[7rem] flex-1">
          <label className="mb-1 block text-xs text-admin-muted">Symbol</label>
          <Input
            placeholder="EURUSD"
            value={draftSymbol}
            onChange={(e) => setDraftSymbol(e.target.value.toUpperCase())}
            className="h-9"
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1 block text-xs text-admin-muted">Account ID</label>
          <Input placeholder="forex account" value={draftAccount} onChange={(e) => setDraftAccount(e.target.value)} className="h-9" />
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
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-admin-muted">Side</label>
          <select
            className="h-9 rounded-md border border-admin-border bg-admin-bg px-2 text-sm"
            value={side}
            onChange={(e) => {
              setSide(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="buy">Buy / Long</option>
            <option value="sell">Sell / Short</option>
          </select>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-9"
          onClick={() => {
            setSymbol(draftSymbol.trim());
            setAccountId(draftAccount.trim());
            setPage(1);
          }}
        >
          Apply
        </Button>
        <Button type="button" variant="ghost" className="h-9 gap-1" onClick={() => void listQ.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {kind === 'orders' ? (
        <DataTable columns={orderColumns} data={rows as ForexAdminOrderRow[]} loading={listQ.isLoading} sortable={false} compact />
      ) : kind === 'executions' ? (
        <DataTable columns={execColumns} data={rows as ForexAdminExecutionRow[]} loading={listQ.isLoading} sortable={false} compact />
      ) : (
        <DataTable columns={posColumns} data={rows as ForexAdminPositionRow[]} loading={listQ.isLoading} sortable={false} compact />
      )}

      {listQ.isError ? (
        <p className="text-sm text-red-400">{listQ.error instanceof Error ? listQ.error.message : 'Load failed'}</p>
      ) : null}

      {pagination ? (
        <div className="flex items-center justify-between text-sm text-admin-muted">
          <span>
            Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.total} total
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pagination.totalPages > 0 && page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
