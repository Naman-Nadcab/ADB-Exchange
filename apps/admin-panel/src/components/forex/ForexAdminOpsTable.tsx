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
  adminCloseByForexPosition,
  adminCloseForexPosition,
  adminModifyForexOrder,
  adminPlaceForexOrder,
  adminSetForexProtection,
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
import { ChevronLeft, ChevronRight, Download, Layers, RefreshCw, ShoppingCart, Zap } from 'lucide-react';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import { ForexFilterBar, ForexSectionLabel, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';
import { Modal } from '@/components/ui/Modal';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import Link from 'next/link';

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
    <Badge variant={buyish ? 'success' : 'danger'} className="text-[9px] font-normal uppercase">
      {side}
    </Badge>
  );
}

const TERMINAL_ORDER = new Set(['FILLED', 'REJECTED', 'CANCELLED', 'FAILED']);

export function ForexAdminOpsTable({
  kind,
  layout = 'page',
}: {
  kind: ForexOpsTableKind;
  /** `section` = nested block (no page header / trading nav). */
  layout?: 'page' | 'section';
}) {
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
  const [managerAction, setManagerAction] = useState<'close' | 'closeby' | 'sl' | 'tp' | null>(null);
  const [orderAction, setOrderAction] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeAccount, setPlaceAccount] = useState('');
  const [placeSymbol, setPlaceSymbol] = useState('');
  const [placeSide, setPlaceSide] = useState('buy');
  const [placeType, setPlaceType] = useState('market');
  const [placeVolume, setPlaceVolume] = useState('');
  const [placePrice, setPlacePrice] = useState('');
  const [placeLimit, setPlaceLimit] = useState('');

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

  const managerM = useMutation({
    mutationFn: async (args: { reason: string }) => {
      if (!detailPos || !managerAction) throw new Error('No position');
      if (managerAction === 'close') {
        const volume = (document.getElementById('mgr-volume') as HTMLInputElement | null)?.value.trim();
        const res = await adminCloseForexPosition(token, detailPos.position_id, { reason: args.reason, volume: volume || undefined });
        if (!res.success) throw new Error(res.error?.message ?? 'Close failed');
        return res.data;
      }
      if (managerAction === 'closeby') {
        const opposite = (document.getElementById('mgr-opposite') as HTMLInputElement | null)?.value.trim() ?? '';
        const volume = (document.getElementById('mgr-volume') as HTMLInputElement | null)?.value.trim();
        if (!opposite) throw new Error('Opposite position id is required');
        const res = await adminCloseByForexPosition(token, detailPos.position_id, {
          reason: args.reason,
          opposite_position_id: opposite,
          ...(volume ? { volume } : {}),
        });
        if (!res.success) throw new Error(res.error?.message ?? 'Close By failed');
        return res.data;
      }
      const price = (document.getElementById(managerAction === 'sl' ? 'mgr-sl' : 'mgr-tp') as HTMLInputElement | null)?.value.trim() ?? '';
      const trail = (document.getElementById('mgr-trail') as HTMLInputElement | null)?.value.trim() ?? '';
      const res = await adminSetForexProtection(token, detailPos.position_id, {
        reason: args.reason,
        type: managerAction === 'sl' ? 'STOP_LOSS' : 'TAKE_PROFIT',
        trigger_price: price,
        ...(managerAction === 'sl' && trail ? { trailing_distance: trail } : {}),
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Protection failed');
      return res.data;
    },
    onSuccess: () => {
      setManagerAction(null);
      setDetailPos(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
    },
  });

  const placeM = useMutation({
    mutationFn: async (reason: string) => {
      const res = await adminPlaceForexOrder(token, {
        reason,
        account_id: placeAccount.trim(),
        symbol: placeSymbol.trim(),
        side: placeSide,
        order_type: placeType,
        volume: placeVolume.trim(),
        ...(placePrice.trim() ? { requested_price: placePrice.trim() } : {}),
        ...(placeLimit.trim() ? { limit_price: placeLimit.trim() } : {}),
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Place failed');
      return res.data;
    },
    onSuccess: () => {
      setPlaceOpen(false);
      setPlaceVolume('');
      setPlacePrice('');
      setPlaceLimit('');
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
    },
  });

  const modifyM = useMutation({
    mutationFn: async (reason: string) => {
      if (!detailOrder) throw new Error('No order');
      const volume = (document.getElementById('mod-volume') as HTMLInputElement | null)?.value.trim() ?? '';
      const price = (document.getElementById('mod-price') as HTMLInputElement | null)?.value.trim() ?? '';
      const limit = (document.getElementById('mod-limit') as HTMLInputElement | null)?.value.trim() ?? '';
      const res = await adminModifyForexOrder(token, detailOrder.order_id, {
        reason,
        ...(volume ? { volume } : {}),
        ...(price ? { requested_price: price } : {}),
        ...(limit ? { limit_price: limit } : {}),
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Modify failed');
      return res.data;
    },
    onSuccess: () => {
      setOrderAction(false);
      setDetailOrder(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
    },
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
      ? 'Working, pending, and historical customer orders — MOCK venue.'
      : kind === 'executions'
        ? 'MOCK venue fills, slippage, and fill lineage.'
        : 'NETTING/HEDGING posture, open exposure, Close By / Reverse audit.';

  const pageStats = useMemo(() => {
    if (kind === 'orders') {
      const r = rows as ForexAdminOrderRow[];
      return {
        a: String(pagination?.total ?? r.length),
        b: String(r.filter((x) => !TERMINAL_ORDER.has(x.status.toUpperCase())).length),
        c: String(r.filter((x) => x.failure_reason).length),
        d: symbol || accountId ? 'Filtered' : 'All',
      };
    }
    if (kind === 'executions') {
      const r = rows as ForexAdminExecutionRow[];
      return {
        a: String(pagination?.total ?? r.length),
        b: String(r.filter((x) => x.status.toUpperCase() === 'FILLED').length),
        c: String(r.filter((x) => x.failure_reason).length),
        d: symbol || accountId ? 'Filtered' : 'All',
      };
    }
    const r = rows as ForexAdminPositionRow[];
    return {
      a: String(pagination?.total ?? r.length),
      b: String(r.filter((x) => x.status.toUpperCase() === 'OPEN').length),
      c: String(new Set(r.map((x) => x.symbol)).size),
      d: symbol || accountId ? 'Filtered' : 'All',
    };
  }, [kind, rows, pagination?.total, symbol, accountId]);

  const headerIcon = kind === 'orders' ? ShoppingCart : kind === 'executions' ? Zap : Layers;

  const workspace = (
    <>

      {kind === 'orders' ? (
        <ForexWorkspaceSurface className="border-admin-danger/30 bg-admin-danger/10">
          <ForexSectionLabel>Force-cancel audit</ForexSectionLabel>
          <Input value={opsReason} onChange={(e) => setOpsReason(e.target.value)} placeholder="Ops ticket reference (min 8 chars)" className="h-9 max-w-lg text-sm" />
        </ForexWorkspaceSurface>
      ) : null}

      {kind === 'orders' ? (
        <ForexWorkspaceSurface>
          <ForexSectionLabel>Place for client</ForexSectionLabel>
          <p className="mt-1 text-xs text-admin-muted">Places on that account. The customer ticket still has no time-in-force picker.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <Input placeholder="Account id" value={placeAccount} onChange={(e) => setPlaceAccount(e.target.value)} className="h-9 font-mono text-xs" />
            <Input placeholder="Symbol" value={placeSymbol} onChange={(e) => setPlaceSymbol(e.target.value.toUpperCase())} className="h-9" />
            <select value={placeSide} onChange={(e) => setPlaceSide(e.target.value)} className="h-9 rounded border border-admin-border bg-admin-bg px-2 text-sm">
              <option value="buy">buy</option>
              <option value="sell">sell</option>
            </select>
            <select value={placeType} onChange={(e) => setPlaceType(e.target.value)} className="h-9 rounded border border-admin-border bg-admin-bg px-2 text-sm">
              <option value="market">market</option>
              <option value="limit">limit</option>
              <option value="stop">stop</option>
              <option value="stop_limit">stop_limit</option>
            </select>
            <Input placeholder="Volume" value={placeVolume} onChange={(e) => setPlaceVolume(e.target.value)} className="h-9" />
            <Input placeholder="Price" value={placePrice} onChange={(e) => setPlacePrice(e.target.value)} className="h-9" />
            <Input placeholder="Limit price" value={placeLimit} onChange={(e) => setPlaceLimit(e.target.value)} className="h-9" />
          </div>
          <ProtectedAction permission="forex:dealing:manage" fallback="disabled">
            <Button type="button" size="sm" className="mt-3" disabled={!placeAccount.trim() || !placeSymbol.trim() || !placeVolume.trim()} onClick={() => setPlaceOpen(true)}>
              Place order
            </Button>
          </ProtectedAction>
        </ForexWorkspaceSurface>
      ) : null}

      <ForexWorkspaceSurface noPadding>
        <div className="border-b border-admin-border px-4 py-3">
          <ForexSectionLabel icon={headerIcon}>Trading workspace · {title}</ForexSectionLabel>
          <ForexFilterBar className="mt-2 border-0 bg-transparent p-0">
            <Input placeholder="Symbol" value={draftSymbol} onChange={(e) => setDraftSymbol(e.target.value.toUpperCase())} className="h-9 w-28" />
            <Input placeholder="Account ID" value={draftAccount} onChange={(e) => setDraftAccount(e.target.value)} className="h-9 w-40 font-mono text-xs" />
            <select
              className="h-9 rounded-md border border-admin-border bg-admin-bg px-2 text-xs"
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
            <select
              className="h-9 rounded-md border border-admin-border bg-admin-bg px-2 text-xs"
              value={side}
              onChange={(e) => {
                setSide(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All sides</option>
              <option value="buy">Buy / Long</option>
              <option value="sell">Sell / Short</option>
            </select>
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
              <RefreshCw className={`h-3.5 w-3.5 ${listQ.isFetching ? 'animate-spin' : ''}`} />
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
                CSV
              </Button>
            ) : null}
          </ForexFilterBar>
        </div>
        {cancelM.isError ? (
          <p className="px-4 py-2 text-xs text-red-400">{cancelM.error instanceof Error ? cancelM.error.message : 'Cancel failed'}</p>
        ) : null}
        {kind === 'orders' ? (
          <DataTable columns={orderColumns} data={rows as ForexAdminOrderRow[]} loading={listQ.isLoading} sortable={false} compact />
        ) : kind === 'executions' ? (
          <DataTable columns={execColumns} data={rows as ForexAdminExecutionRow[]} loading={listQ.isLoading} sortable={false} compact />
        ) : (
          <DataTable columns={posColumns} data={rows as ForexAdminPositionRow[]} loading={listQ.isLoading} sortable={false} compact />
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
      </ForexWorkspaceSurface>

      {listQ.isError ? (
        <p className="text-sm text-red-400">{listQ.error instanceof Error ? listQ.error.message : 'Load failed'}</p>
      ) : null}

      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title="Order detail">
        {detailOrder ? (
          <>
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
          {(detailOrder.status === 'PENDING' || detailOrder.status === 'ACCEPTED') ? (
            <ProtectedAction permission="forex:dealing:manage" fallback="hidden">
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <label className="text-xs text-admin-muted">Volume<Input id="mod-volume" className="mt-1 h-8 font-mono" placeholder="Leave blank to keep" /></label>
                <label className="text-xs text-admin-muted">Price<Input id="mod-price" className="mt-1 h-8 font-mono" placeholder="Trigger / limit" /></label>
                <label className="text-xs text-admin-muted">Limit price<Input id="mod-limit" className="mt-1 h-8 font-mono" placeholder="Stop limit only" /></label>
                <Button type="button" size="sm" variant="secondary" onClick={() => setOrderAction(true)}>Modify</Button>
              </div>
            </ProtectedAction>
          ) : null}
          </>
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
          <>
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
          {detailPos.status === 'OPEN' ? (
            <ProtectedAction permission="forex:dealing:manage" fallback="hidden">
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <label className="text-xs text-admin-muted">
                  Close volume
                  <Input id="mgr-volume" className="mt-1 h-8 font-mono" placeholder="Blank = full" />
                </label>
                {detailPos.mode.toUpperCase() === 'HEDGING' ? (
                  <label className="text-xs text-admin-muted sm:col-span-2">
                    Opposite position
                    <Input id="mgr-opposite" className="mt-1 h-8 font-mono" placeholder="Hedging position on the other side" />
                  </label>
                ) : null}
                <label className="text-xs text-admin-muted">
                  Stop loss
                  <Input id="mgr-sl" className="mt-1 h-8 font-mono" placeholder="Price" />
                </label>
                <label className="text-xs text-admin-muted">
                  Trail distance
                  <Input id="mgr-trail" className="mt-1 h-8 font-mono" placeholder="With stop loss" />
                </label>
                <label className="text-xs text-admin-muted">
                  Take profit
                  <Input id="mgr-tp" className="mt-1 h-8 font-mono" placeholder="Price" />
                </label>
                <Button type="button" size="sm" variant="danger" onClick={() => setManagerAction('close')}>Close</Button>
                {detailPos.mode.toUpperCase() === 'HEDGING' ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setManagerAction('closeby')}>Close By</Button>
                ) : null}
                <Button type="button" size="sm" variant="secondary" onClick={() => setManagerAction('sl')}>Set SL</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setManagerAction('tp')}>Set TP</Button>
              </div>
            </ProtectedAction>
          ) : null}
          </>
        ) : null}
      </Modal>
      <ForexConfirmModal
        open={!!managerAction && !!detailPos}
        onClose={() => setManagerAction(null)}
        title={managerAction === 'close' ? 'Manager close' : managerAction === 'closeby' ? 'Close By' : managerAction === 'sl' ? 'Set stop loss' : 'Set take profit'}
        description={detailPos ? `${detailPos.symbol} · ${detailPos.position_id}` : undefined}
        dangerous={managerAction === 'close' || managerAction === 'closeby'}
        loading={managerM.isPending}
        onConfirm={async (reason) => {
          await managerM.mutateAsync({ reason });
        }}
      />
      <ForexConfirmModal
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        title="Place for client"
        description={`${placeSide} ${placeType} ${placeVolume} ${placeSymbol}`}
        loading={placeM.isPending}
        onConfirm={async (reason) => {
          await placeM.mutateAsync(reason);
        }}
      />
      <ForexConfirmModal
        open={orderAction && !!detailOrder}
        onClose={() => setOrderAction(false)}
        title="Modify working order"
        description={detailOrder ? `${detailOrder.symbol} · ${detailOrder.order_id}` : undefined}
        loading={modifyM.isPending}
        onConfirm={async (reason) => {
          await modifyM.mutateAsync(reason);
        }}
      />
    </>
  );

  if (layout === 'section') {
    return <div className="space-y-3">{workspace}</div>;
  }

  return (
    <div className="space-y-4">
      <ForexWorkspaceHeader
        title={title}
        purpose={description}
        dataSource={`Admin Forex API · ${kind} list`}
        posture="MOCK"
        kpis={
          kind === 'orders'
            ? [
                { label: 'Total (scope)', value: pageStats.a },
                { label: 'Non-terminal (page)', value: pageStats.b, tone: Number(pageStats.b) > 0 ? 'warning' : undefined },
                { label: 'Reject hint (page)', value: pageStats.c },
                { label: 'Scope', value: pageStats.d },
              ]
            : kind === 'executions'
              ? [
                  { label: 'Total (scope)', value: pageStats.a },
                  { label: 'Filled (page)', value: pageStats.b, tone: 'success' },
                  { label: 'Failures (page)', value: pageStats.c, tone: Number(pageStats.c) > 0 ? 'warning' : undefined },
                  { label: 'Scope', value: pageStats.d },
                ]
              : [
                  { label: 'Total (scope)', value: pageStats.a },
                  { label: 'Open (page)', value: pageStats.b },
                  { label: 'Symbols (page)', value: pageStats.c },
                  { label: 'Scope', value: pageStats.d },
                ]
        }
      />

      <div className="flex flex-wrap gap-2 text-[10px]">
        <Link href="/forex/orders" className="rounded-md border border-admin-border/60 px-2 py-1 hover:border-violet-500/40">
          Orders
        </Link>
        <Link href="/forex/executions" className="rounded-md border border-admin-border/60 px-2 py-1 hover:border-violet-500/40">
          Executions
        </Link>
        <Link href="/forex/positions" className="rounded-md border border-admin-border/60 px-2 py-1 hover:border-violet-500/40">
          Positions
        </Link>
        <Link href="/forex/dealing" className="rounded-md border border-admin-border/60 px-2 py-1 hover:border-violet-500/40">
          Dealing desk
        </Link>
        <Link href="/forex/protection" className="rounded-md border border-admin-border/60 px-2 py-1 hover:border-violet-500/40">
          Protection
        </Link>
      </div>

      {workspace}
    </div>
  );
}
