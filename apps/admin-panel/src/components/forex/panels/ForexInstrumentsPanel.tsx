'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminConfig,
  getForexAdminControls,
  patchForexInstrumentTradingStatus,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ForexRouteWorkspace } from '@/components/forex/primitives/ForexRouteWorkspace';
import { ForexListWorkspace } from '@/components/forex/primitives/ForexListWorkspace';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { CandlestickChart, Eye, PauseCircle, PlayCircle, Search } from 'lucide-react';

export type ForexInstrumentRow = {
  symbol: string;
  tradingStatus: string;
  maxLeverage: string | number;
  minVolume: string;
  maxVolume: string;
  marginPercent: string;
  commission: string;
  commissionType: string;
  swapLong: string;
  swapShort: string;
  overridden?: boolean;
};

function parseInstruments(raw: unknown): ForexInstrumentRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is ForexInstrumentRow => r && typeof r === 'object' && 'symbol' in r);
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'open') return 'success';
  if (s === 'halted' || s === 'halt' || s === 'closed') return 'danger';
  return 'warning';
}

type StatusAction = { symbol: string; displaySymbol: string; nextStatus: string; label: string };

export function ForexInstrumentsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<ForexInstrumentRow | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);

  const configQ = useQuery({
    queryKey: ['admin', 'forex', 'config', 'instruments-panel', token],
    queryFn: async () => {
      const res = await getForexAdminConfig(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const controlsQ = useQuery({
    queryKey: ['admin', 'forex', 'controls', 'instruments-panel', token],
    queryFn: async () => {
      const res = await getForexAdminControls(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 10_000,
  });

  const statusBySymbol = useMemo(() => {
    const map = new Map<string, { status: string; overridden: boolean }>();
    for (const i of controlsQ.data?.instruments ?? []) {
      map.set(i.symbol, { status: i.tradingStatus, overridden: i.overridden });
    }
    return map;
  }, [controlsQ.data]);

  const rows = useMemo(() => {
    const base = parseInstruments(configQ.data?.config.instruments);
    return base.map((r) => {
      const ctrl = statusBySymbol.get(r.symbol);
      return {
        ...r,
        tradingStatus: ctrl?.status ?? r.tradingStatus,
        overridden: ctrl?.overridden ?? false,
      };
    });
  }, [configQ.data, statusBySymbol]);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    if (!needle) return rows;
    return rows.filter((r) => r.symbol.toUpperCase().includes(needle));
  }, [rows, q]);

  const statusM = useMutation({
    mutationFn: async (args: { symbol: string; trading_status: string; reason: string }) => {
      const res = await patchForexInstrumentTradingStatus(token, args.symbol, {
        trading_status: args.trading_status,
        reason: args.reason,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Update failed');
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
      setStatusAction(null);
    },
  });

  const columns = useMemo<ColumnDef<ForexInstrumentRow>[]>(
    () => [
      {
        accessorKey: 'symbol',
        header: 'Symbol',
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-foreground">{row.original.symbol}</span>
            {row.original.overridden ? (
              <span className="ml-1 text-[10px] text-admin-warning">override</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'tradingStatus',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.tradingStatus)} className="font-normal capitalize">
            {row.original.tradingStatus}
          </Badge>
        ),
      },
      {
        accessorKey: 'maxLeverage',
        header: 'Max lev.',
        cell: ({ row }) => <span className="tabular-nums">{row.original.maxLeverage}×</span>,
      },
      {
        id: 'volume',
        header: 'Volume',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-admin-muted">
            {row.original.minVolume} – {row.original.maxVolume}
          </span>
        ),
      },
      {
        accessorKey: 'marginPercent',
        header: 'Margin',
        cell: ({ row }) => <span className="tabular-nums">{row.original.marginPercent}%</span>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const sym = row.original.symbol;
          const st = row.original.tradingStatus.toLowerCase();
          const isActive = st === 'active';
          return (
            <div className="flex justify-end gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => setDetail(row.original)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <ProtectedAction permission="forex:control" fallback="hidden">
                {isActive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs"
                    onClick={() =>
                      setStatusAction({
                        symbol: sym,
                        displaySymbol: sym,
                        nextStatus: 'halted',
                        label: 'Halt trading',
                      })
                    }
                  >
                    <PauseCircle className="h-3.5 w-3.5" />
                    Halt
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs"
                    onClick={() =>
                      setStatusAction({
                        symbol: sym,
                        displaySymbol: sym,
                        nextStatus: 'active',
                        label: 'Resume trading',
                      })
                    }
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Resume
                  </Button>
                )}
              </ProtectedAction>
            </div>
          );
        },
      },
    ],
    [],
  );

  const loading = configQ.isLoading || controlsQ.isLoading;
  const activeCount = rows.filter((r) => r.tradingStatus.toLowerCase() === 'active').length;
  const haltedCount = rows.filter((r) => ['halted', 'halt', 'closed'].includes(r.tradingStatus.toLowerCase())).length;

  return (
    <>
      <ForexRouteWorkspace
        routeId="instruments"
        kpis={[
          { label: 'Symbols', value: String(rows.length) },
          { label: 'Active', value: String(activeCount), tone: 'success' },
          { label: 'Halted / closed', value: String(haltedCount), tone: haltedCount > 0 ? 'warning' : 'default' },
          { label: 'Filtered view', value: filtered.length === rows.length ? 'All' : String(filtered.length) },
        ]}
      />
      <ForexListWorkspace
        icon={CandlestickChart}
        title="Instrument catalog"
        description="Halt or resume from the desk · policy edits on Margin & Risk"
        filters={
          <div className="relative w-full min-w-[12rem] sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted" />
            <Input placeholder="Search symbol…" value={q} onChange={(e) => setQ(e.target.value.toUpperCase())} className="h-9 pl-8" />
          </div>
        }
      >
        <DataTable columns={columns} data={filtered} loading={loading} sortable compact />
      </ForexListWorkspace>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.symbol ?? 'Instrument'}
        description="Contract specification snapshot"
        size="lg"
      >
        {detail ? (
          <ForexDetailGrid
            columns={2}
            items={[
              { label: 'Trading status', value: detail.tradingStatus, highlight: statusVariant(detail.tradingStatus) === 'success' ? 'success' : 'warning' },
              { label: 'Max leverage', value: `${detail.maxLeverage}×` },
              { label: 'Min volume', value: detail.minVolume, mono: true },
              { label: 'Max volume', value: detail.maxVolume, mono: true },
              { label: 'Margin percent', value: `${detail.marginPercent}%` },
              { label: 'Commission', value: `${detail.commissionType} · ${detail.commission}` },
              { label: 'Swap long', value: detail.swapLong, mono: true },
              { label: 'Swap short', value: detail.swapShort, mono: true },
            ]}
          />
        ) : null}
        <ModalFooter className="-mx-6 mt-4 border-t border-admin-border px-6">
          <Button type="button" variant="secondary" size="sm" onClick={() => setDetail(null)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <ForexConfirmModal
        open={!!statusAction}
        onClose={() => setStatusAction(null)}
        title={statusAction?.label ?? 'Update instrument'}
        description={
          statusAction
            ? `Set ${statusAction.displaySymbol} to “${statusAction.nextStatus}”. New customer orders for this symbol will follow this status.`
            : undefined
        }
        confirmLabel={statusAction?.label ?? 'Confirm'}
        dangerous={statusAction?.nextStatus === 'halted'}
        loading={statusM.isPending}
        onConfirm={async (reason) => {
          if (!statusAction) return;
          await statusM.mutateAsync({
            symbol: statusAction.symbol,
            trading_status: statusAction.nextStatus,
            reason,
          });
        }}
      />
      {statusM.isError ? (
        <p className="text-sm text-red-400">{statusM.error instanceof Error ? statusM.error.message : 'Update failed'}</p>
      ) : null}
    </>
  );
}
