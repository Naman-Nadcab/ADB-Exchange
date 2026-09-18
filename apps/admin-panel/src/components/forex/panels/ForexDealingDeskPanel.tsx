'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminControls,
  getForexAdminDealingQueue,
  postForexDealerAccept,
  postForexDealerAssign,
  postForexDealerEscalate,
  postForexDealerReject,
  type ForexAdminDealingQueueRow,
} from '@/lib/admin/forex-api';
import { DataTable } from '@/components/ui/DataTable';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { KpiSkeleton } from '@/components/ui/Skeleton';
import { ArrowRight, Hand } from 'lucide-react';
import { ForexDealerActionDialog, type DealerDialogAction } from '@/components/forex/panels/ForexDealerActionDialog';
import { ForexDealingOrderDrawer } from '@/components/forex/panels/ForexDealingOrderDrawer';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import {
  ForexDealerActionBar,
  ForexFilterBar,
  ForexIdentityBlock,
  ForexSectionLabel,
  ForexWorkspaceSurface,
} from '@/components/forex/primitives/forex-visual-kit';
import { Input } from '@/components/ui/Input';
import { Clock, User } from 'lucide-react';

type DealingSnap = {
  emergencyHalt?: boolean;
  emergencyAllowRiskReduction?: boolean;
  symbol?: {
    enabled?: boolean;
    buyEnabled?: boolean;
    sellEnabled?: boolean;
    newOrderEnabled?: boolean;
    riskReductionEnabled?: boolean;
  };
  account?: {
    enabled?: boolean;
    newOrderEnabled?: boolean;
    riskReductionEnabled?: boolean;
  };
  source?: string;
};

function asDealing(raw: unknown): DealingSnap | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as DealingSnap;
}

function flag(value: boolean | undefined, good = true) {
  if (value === undefined) return '—';
  const ok = good ? value : !value;
  return ok ? 'Yes' : 'No';
}

export function ForexDealingDeskPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [queuePage, setQueuePage] = useState(1);
  const [queueSymbol, setQueueSymbol] = useState('');
  const [queueAccount, setQueueAccount] = useState('');
  const [draftQueueSymbol, setDraftQueueSymbol] = useState('');
  const [draftQueueAccount, setDraftQueueAccount] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ForexAdminDealingQueueRow | null>(null);
  const [pendingAction, setPendingAction] = useState<DealerDialogAction | null>(null);

  const dealerAction = useMutation({
    mutationFn: async (input: {
      orderId: string;
      action: DealerDialogAction;
      reason: string;
      assigneeAdminId?: string;
      escalationAdminId?: string;
    }) => {
      if (input.action === 'accept') {
        const res = await postForexDealerAccept(token, input.orderId, input.reason);
        if (!res.success) throw new Error(res.error?.message ?? 'Accept failed');
        return res.data;
      }
      if (input.action === 'reject') {
        const res = await postForexDealerReject(token, input.orderId, input.reason);
        if (!res.success) throw new Error(res.error?.message ?? 'Reject failed');
        return res.data;
      }
      if (input.action === 'assign') {
        const res = await postForexDealerAssign(token, input.orderId, input.assigneeAdminId!, input.reason);
        if (!res.success) throw new Error(res.error?.message ?? 'Assign failed');
        return res.data;
      }
      const res = await postForexDealerEscalate(token, input.orderId, input.escalationAdminId!, input.reason);
      if (!res.success) throw new Error(res.error?.message ?? 'Escalate failed');
      return res.data;
    },
    onSuccess: () => {
      setPendingAction(null);
      setSelectedOrder(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'dealing', 'queue'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'dealing', 'actions'] });
    },
  });

  const q = useQuery({
    queryKey: ['admin', 'forex', 'controls', 'dealing-desk', token],
    queryFn: async () => {
      const res = await getForexAdminControls(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 10_000,
  });

  const dealing = asDealing(q.data?.dealing);

  const queueQ = useQuery({
    queryKey: ['admin', 'forex', 'dealing', 'queue', token, queuePage, queueSymbol, queueAccount],
    queryFn: async () => {
      const res = await getForexAdminDealingQueue(token, {
        page: queuePage,
        symbol: queueSymbol || undefined,
        account_id: queueAccount || undefined,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Queue failed');
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const openAction = (order: ForexAdminDealingQueueRow, action: DealerDialogAction) => {
    setSelectedOrder(order);
    setPendingAction(action);
  };

  const queueColumns = useMemo<ColumnDef<ForexAdminDealingQueueRow>[]>(
    () => [
      {
        accessorKey: 'order_id',
        header: 'Order',
        cell: ({ row }) => (
          <button
            type="button"
            className="font-mono text-[10px] text-admin-accent hover:underline"
            onClick={() => setSelectedOrder(row.original)}
          >
            {row.original.order_id.slice(0, 8)}…
          </button>
        ),
      },
      { accessorKey: 'account_id', header: 'Account', cell: ({ row }) => <span className="font-mono text-[10px]">{row.original.account_id}</span> },
      { accessorKey: 'symbol', header: 'Symbol' },
      { accessorKey: 'side', header: 'Side' },
      { accessorKey: 'requested_volume', header: 'Vol' },
      { accessorKey: 'requested_price', header: 'Req px', cell: ({ row }) => row.original.requested_price ?? '—' },
      { accessorKey: 'current_price', header: 'Mkt', cell: ({ row }) => row.original.current_price ?? '—' },
      { accessorKey: 'status', header: 'Status' },
      {
        accessorKey: 'age_sec',
        header: 'Age / SLA',
        cell: ({ row }) => {
          const sec = row.original.age_sec;
          const variant = sec > 300 ? 'danger' : sec > 60 ? 'warning' : 'default';
          return (
            <Badge variant={variant} className="font-mono text-[10px] font-normal">
              {sec}s
            </Badge>
          );
        },
      },
      { accessorKey: 'execution_mode', header: 'Mode', cell: ({ getValue }) => String(getValue()) },
      {
        id: 'dealer_actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => openAction(row.original, 'accept')}>
              Accept
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => openAction(row.original, 'reject')}>
              Reject
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => openAction(row.original, 'assign')}>
              Assign
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => openAction(row.original, 'escalate')}>
              Escalate
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const queueRows = queueQ.data?.rows ?? [];

  useEffect(() => {
    if (!selectedOrder && queueRows.length > 0) {
      setSelectedOrder(queueRows[0]!);
    }
  }, [queueRows, selectedOrder]);

  if (q.isLoading) return <KpiSkeleton count={2} />;
  if (q.isError) return <p className="text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Load failed'}</p>;

  const queueTotal = queueQ.data?.pagination.total ?? 0;
  const maxAge = Math.max(0, ...queueRows.map((r) => r.age_sec));

  const active = selectedOrder;

  return (
    <div className="admin-stack-lg relative">
      <ForexWorkspaceHeader
        title="Dealer workstation"
        purpose="Review incoming MOCK queue, accept/reject/assign/escalate with audited reasons."
        dataSource="forex_orders (non-terminal statuses)"
        posture="MOCK"
        kpis={[
          { label: 'Queue depth', value: String(queueTotal), tone: queueTotal > 10 ? 'warning' : 'default' },
          { label: 'Oldest age', value: queueTotal ? `${maxAge}s` : '—', tone: maxAge > 300 ? 'danger' : undefined },
          { label: 'Emergency halt', value: dealing?.emergencyHalt ? 'ON' : 'Off', tone: dealing?.emergencyHalt ? 'danger' : 'success' },
          { label: 'Price feed', value: 'NOT_AVAILABLE', tone: 'warning' },
        ]}
      />
      <ForexDealerActionDialog
        open={!!pendingAction && !!selectedOrder}
        action={pendingAction}
        order={selectedOrder}
        loading={dealerAction.isPending}
        onClose={() => setPendingAction(null)}
        onConfirm={async (payload) => {
          if (!selectedOrder || !pendingAction) return;
          await dealerAction.mutateAsync({
            orderId: selectedOrder.order_id,
            action: pendingAction,
            reason: payload.reason,
            assigneeAdminId: payload.assigneeAdminId,
            escalationAdminId: payload.escalationAdminId,
          });
        }}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-admin-border/70 bg-admin-bg/30 px-3 py-2">
        <Badge variant={dealing?.emergencyHalt ? 'danger' : 'success'} className="font-normal">
          Halt {dealing?.emergencyHalt ? 'ON' : 'Off'}
        </Badge>
        <Badge variant="info" className="gap-1 font-normal">
          <Hand className="h-3 w-3" />
          {dealing?.source ?? 'MOCK'}
        </Badge>
        <Badge variant="default" className="font-normal">
          Symbol orders {flag(dealing?.symbol?.newOrderEnabled, true)}
        </Badge>
        <Link href="/forex/orders" className="ml-auto text-xs text-violet-400 hover:text-violet-300">
          All orders →
        </Link>
      </div>

      <div className="grid min-h-[520px] grid-cols-1 gap-3 xl:grid-cols-12">
        <ForexWorkspaceSurface className="xl:col-span-3 flex flex-col gap-2" noPadding>
          <div className="border-b border-admin-border p-3">
            <ForexSectionLabel icon={Clock}>Incoming queue</ForexSectionLabel>
            <ForexFilterBar className="mt-2 border-0 bg-transparent p-0">
              <Input className="h-8 w-24 text-xs" value={draftQueueSymbol} onChange={(e) => setDraftQueueSymbol(e.target.value.toUpperCase())} placeholder="Symbol" />
              <Input className="h-8 w-32 font-mono text-[10px]" value={draftQueueAccount} onChange={(e) => setDraftQueueAccount(e.target.value)} placeholder="Account" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={() => {
                  setQueueSymbol(draftQueueSymbol.trim());
                  setQueueAccount(draftQueueAccount.trim());
                  setQueuePage(1);
                }}
              >
                Apply
              </Button>
            </ForexFilterBar>
          </div>
          <div className="max-h-[420px] flex-1 space-y-2 overflow-y-auto p-2">
            {queueQ.isLoading ? (
              <p className="p-2 text-xs text-admin-muted">Loading…</p>
            ) : queueRows.length === 0 ? (
              <p className="p-2 text-xs text-admin-muted">Queue empty.</p>
            ) : (
              queueRows.map((row) => (
                <ForexIdentityBlock
                  key={row.order_id}
                  name={`${row.symbol} · ${row.side}`}
                  subtitle={`${row.requested_volume} lots · ${row.age_sec}s`}
                  avatarSeed={row.symbol}
                  selected={active?.order_id === row.order_id}
                  onClick={() => setSelectedOrder(row)}
                  chips={[
                    { label: row.status, variant: row.age_sec > 300 ? 'danger' : row.age_sec > 60 ? 'warning' : 'default' },
                    { label: row.execution_mode, variant: 'info' },
                  ]}
                />
              ))
            )}
          </div>
          {queueQ.data && queueQ.data.pagination.totalPages > 1 ? (
            <div className="flex justify-between border-t border-admin-border p-2">
              <Button size="sm" variant="ghost" disabled={queuePage <= 1} onClick={() => setQueuePage((p) => p - 1)}>
                Prev
              </Button>
              <Button size="sm" variant="ghost" disabled={queuePage >= queueQ.data.pagination.totalPages} onClick={() => setQueuePage((p) => p + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </ForexWorkspaceSurface>

        <ForexWorkspaceSurface className="xl:col-span-5 flex flex-col">
          <ForexSectionLabel>Execution context</ForexSectionLabel>
          {!active ? (
            <p className="text-sm text-admin-muted">Select a queue item to review execution context.</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-admin-border/60 bg-admin-bg/40 p-3">
                  <p className="text-[10px] uppercase text-admin-muted">Side / volume</p>
                  <p className="text-lg font-semibold text-foreground">
                    {active.side}{' '}
                    <span className="font-mono text-base tabular-nums">{active.requested_volume}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-admin-border/60 bg-admin-bg/40 p-3">
                  <p className="text-[10px] uppercase text-admin-muted">Requested</p>
                  <p className="font-mono text-lg tabular-nums">{active.requested_price ?? '—'}</p>
                </div>
                <div className="rounded-lg border border-admin-border/60 bg-admin-bg/40 p-3">
                  <p className="text-[10px] uppercase text-admin-muted">Market quote</p>
                  <p className="font-mono text-lg tabular-nums text-violet-300">{active.current_price ?? 'NOT AVAILABLE'}</p>
                  <p className="text-[10px] text-admin-muted">{active.price_source}</p>
                </div>
              </div>
              <ForexDetailGrid
                columns={2}
                items={[
                  { label: 'Order', value: active.order_id, mono: true },
                  { label: 'Status', value: active.status },
                  { label: 'Age', value: `${active.age_sec}s` },
                  { label: 'Mode', value: active.execution_mode },
                ]}
              />
              <div className="mt-4">
                <ForexDealerActionBar
                  disabled={dealerAction.isPending}
                  onAccept={() => openAction(active, 'accept')}
                  onReject={() => openAction(active, 'reject')}
                  onAssign={() => openAction(active, 'assign')}
                  onEscalate={() => openAction(active, 'escalate')}
                />
              </div>
            </>
          )}
        </ForexWorkspaceSurface>

        <ForexWorkspaceSurface className="xl:col-span-4 flex flex-col gap-3">
          <ForexSectionLabel icon={User}>Client & account</ForexSectionLabel>
          {!active ? (
            <p className="text-xs text-admin-muted">Account context appears when an order is selected.</p>
          ) : (
            <>
              <ForexIdentityBlock name={active.account_id} subtitle={active.user_id ? `User ${active.user_id}` : 'User not linked'} avatarSeed={active.account_id} />
              <ForexDetailGrid
                columns={2}
                items={[
                  { label: 'Failure reason', value: active.failure_reason ?? '—' },
                  { label: 'Execution id', value: active.execution_id ?? '—', mono: true },
                ]}
              />
              <Link href={`/forex/accounts?highlight=${encodeURIComponent(active.account_id)}`}>
                <Button type="button" variant="secondary" size="sm" className="w-full gap-1">
                  Open account workspace
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </>
          )}
        </ForexWorkspaceSurface>
      </div>

      {active ? (
        <ForexPanelShell title="Dealer audit trail" description="Recent actions on selected order." noPadding>
          <ForexDealingOrderDrawer order={active} onClose={() => {}} onAction={(action) => setPendingAction(action)} embedded />
        </ForexPanelShell>
      ) : null}

      <details className="rounded-lg border border-admin-border/60 bg-admin-bg/20 p-3">
        <summary className="cursor-pointer text-xs font-medium text-admin-muted">Dense queue table</summary>
        <div className="mt-3">
          <DataTable columns={queueColumns} data={queueRows} emptyMessage="No orders in queue." compact />
        </div>
      </details>
    </div>
  );
}
