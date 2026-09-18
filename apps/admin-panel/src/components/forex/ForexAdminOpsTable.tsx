'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminExecutions,
  getForexAdminOrders,
  getForexAdminPositions,
  forceCancelForexAdminOrder,
  downloadForexAdminCsv,
  type ForexAdminExecutionRow,
  type ForexAdminOrderRow,
  type ForexAdminPositionRow,
} from '@/lib/admin/forex-api';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { Modal } from '@/components/ui/Modal';

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

const TERMINAL_ORDER = new Set(['FILLED', 'REJECTED', 'CANCELLED', 'FAILED']);

export function ForexAdminOpsTable({ kind }: { kind: ForexOpsTableKind }) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [opsReason, setOpsReason] = useState('');
  const [symbol, setSymbol] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState('all');
  const [side, setSide] = useState('all');
  const [draftSymbol, setDraftSymbol] = useState('');
  const [draftAccount, setDraftAccount] = useState('');
  const [detailOrder, setDetailOrder] = useState<ForexAdminOrderRow | null>(null);
  const [detailExec, setDetailExec] = useState<ForexAdminExecutionRow | null>(null);
  const [detailPos, setDetailPos] = useState<ForexAdminPositionRow | null>(null);

  useEffect(() => {
    const ac = searchParams.get('account_id')?.trim();
    if (ac) {
      setAccountId(ac);
      setDraftAccount(ac);
      setPage(1);
    }
  }, [searchParams]);

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

  const cancelM = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await forceCancelForexAdminOrder(token, orderId, { reason: opsReason });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Cancel failed');
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'forex', kind] }),
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
      {
        accessorKey: 'order_id',
        header: 'Order',
        cell: ({ row }) => (
          <button type="button" className="font-mono text-xs text-violet-400 hover:underline" onClick={() => setDetailOrder(row.original)}>
            {shortId(row.original.order_id)}
          </button>
        ),
      },
      { accessorKey: 'execution_mode', header: 'Mode', cell: ({ getValue }) => <span className="text-[10px] uppercase text-admin-muted">{String(getValue())}</span> },
      { accessorKey: 'failure_reason', header: 'Reject', cell: ({ getValue }) => (getValue() ? <span className="text-xs text-red-400/90">{String(getValue())}</span> : '—') },
      {
        id: 'ops',
        header: 'Ops',
        cell: ({ row }) => {
          const st = row.original.status.toUpperCase();
          if (TERMINAL_ORDER.has(st)) return <span className="text-admin-muted">—</span>;
          return (
            <ProtectedAction permission="forex:control" fallback="disabled">
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={cancelM.isPending || opsReason.trim().length < 8}
                onClick={() => cancelM.mutate(row.original.order_id)}
              >
                Force cancel
              </Button>
            </ProtectedAction>
          );
        },
      },
    ],
    [cancelM.isPending, opsReason],
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
      {
        accessorKey: 'execution_id',
        header: 'Exec',
        cell: ({ row }) => (
          <button type="button" className="font-mono text-xs text-violet-400 hover:underline" onClick={() => setDetailExec(row.original)}>
            {shortId(row.original.execution_id)}
          </button>
        ),
      },
      { accessorKey: 'failure_reason', header: 'Failure', cell: ({ getValue }) => (getValue() ? String(getValue()) : '—') },
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
      { accessorKey: 'exposure', header: 'Exposure' },
      {
        accessorKey: 'position_id',
        header: 'Position',
        cell: ({ row }) => (
          <button type="button" className="font-mono text-[10px] text-violet-400 hover:underline" onClick={() => setDetailPos(row.original)}>
            {shortId(row.original.position_id)}
          </button>
        ),
      },
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

  const exportPath =
    kind === 'orders' ? '/forex/orders/export' : kind === 'executions' ? '/forex/executions/export' : null;

  const title =
    kind === 'orders' ? 'Orders' : kind === 'executions' ? 'Executions & fills' : 'Positions';
  const description =
    kind === 'orders'
      ? 'Working and historical customer orders'
      : kind === 'executions'
        ? 'Venue fills, slippage, and lineage'
        : 'Open exposure by account and symbol';

  return (
    <div className="space-y-3">
      {kind === 'orders' ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <label className="mb-1 block text-xs text-admin-muted">Force-cancel audit reason (min 8 chars)</label>
          <Input value={opsReason} onChange={(e) => setOpsReason(e.target.value)} placeholder="Ops ticket reference" className="h-9 max-w-md" />
        </div>
      ) : null}
      <ForexPanelShell title={`Filters · ${title}`} description={description}>
      <div className="flex flex-wrap items-end gap-2">
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
        {exportPath ? (
          <Button
            type="button"
            variant="secondary"
            className="h-9 gap-1"
            onClick={() =>
              void downloadForexAdminCsv(token, exportPath, `forex-${kind}.csv`, {
                symbol: symbol || undefined,
                account_id: accountId || undefined,
                status: status === 'all' ? undefined : status,
                side: side === 'all' ? undefined : side,
              }).catch((e) => alert(e instanceof Error ? e.message : 'Export failed'))
            }
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        ) : null}
      </div>
      </ForexPanelShell>
      {cancelM.isError ? (
        <p className="text-sm text-red-400">{cancelM.error instanceof Error ? cancelM.error.message : 'Cancel failed'}</p>
      ) : null}

      <ForexPanelShell title={title} noPadding>
      {kind === 'orders' ? (
        <DataTable columns={orderColumns} data={rows as ForexAdminOrderRow[]} loading={listQ.isLoading} sortable={false} compact />
      ) : kind === 'executions' ? (
        <DataTable columns={execColumns} data={rows as ForexAdminExecutionRow[]} loading={listQ.isLoading} sortable={false} compact />
      ) : (
        <DataTable columns={posColumns} data={rows as ForexAdminPositionRow[]} loading={listQ.isLoading} sortable={false} compact />
      )}
      </ForexPanelShell>

      {listQ.isError ? (
        <p className="text-sm text-red-400">{listQ.error instanceof Error ? listQ.error.message : 'Load failed'}</p>
      ) : null}

      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title="Order detail">
        {detailOrder ? (
          <ForexDetailGrid
            columns={2}
            items={[
              { label: 'Order ID', value: detailOrder.order_id, mono: true },
              { label: 'Client order', value: detailOrder.client_order_id, mono: true },
              { label: 'Account', value: detailOrder.account_id, mono: true },
              { label: 'Symbol', value: detailOrder.symbol },
              { label: 'Side / type', value: `${detailOrder.side} · ${detailOrder.order_type}` },
              { label: 'Status', value: detailOrder.status },
              { label: 'Volume', value: `${detailOrder.filled_volume} / ${detailOrder.requested_volume} (rem ${detailOrder.remaining_volume})` },
              { label: 'Requested price', value: detailOrder.requested_price ?? '—' },
              { label: 'Execution mode', value: detailOrder.execution_mode },
              { label: 'Failure', value: detailOrder.failure_reason ?? '—' },
              { label: 'Created', value: fmtTime(detailOrder.created_at) },
              { label: 'Updated', value: fmtTime(detailOrder.updated_at) },
            ]}
          />
        ) : null}
      </Modal>

      <Modal open={!!detailExec} onClose={() => setDetailExec(null)} title="Execution detail">
        {detailExec ? (
          <ForexDetailGrid
            columns={2}
            items={[
              { label: 'Execution ID', value: detailExec.execution_id, mono: true },
              { label: 'Account', value: detailExec.account_id ?? '—', mono: true },
              { label: 'Symbol', value: detailExec.symbol },
              { label: 'Side / type', value: `${detailExec.side} · ${detailExec.order_type}` },
              { label: 'Status', value: detailExec.status },
              { label: 'Volume', value: `${detailExec.filled_volume} / ${detailExec.volume}` },
              { label: 'Expected / fill px', value: `${detailExec.expected_price ?? '—'} → ${detailExec.execution_price ?? '—'}` },
              { label: 'Provider', value: detailExec.selected_provider ?? 'MOCK' },
              { label: 'Failure', value: detailExec.failure_reason ?? '—' },
              { label: 'Created', value: fmtTime(detailExec.created_at) },
            ]}
          />
        ) : null}
      </Modal>

      <Modal open={!!detailPos} onClose={() => setDetailPos(null)} title="Position detail">
        {detailPos ? (
          <ForexDetailGrid
            columns={2}
            items={[
              { label: 'Position ID', value: detailPos.position_id, mono: true },
              { label: 'Account', value: detailPos.account_id, mono: true },
              { label: 'Symbol', value: detailPos.symbol },
              { label: 'Side / mode', value: `${detailPos.side} · ${detailPos.mode}` },
              { label: 'Status', value: detailPos.status },
              { label: 'Volume', value: detailPos.volume },
              { label: 'Entry / mark', value: `${detailPos.entry_price} → ${detailPos.current_price}` },
              { label: 'Leverage', value: detailPos.leverage },
              { label: 'Exposure', value: detailPos.exposure },
              { label: 'Opened', value: fmtTime(detailPos.opened_at) },
              { label: 'Updated', value: fmtTime(detailPos.updated_at) },
            ]}
          />
        ) : null}
      </Modal>

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
