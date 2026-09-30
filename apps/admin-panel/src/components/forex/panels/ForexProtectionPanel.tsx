'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminOrders, type ForexAdminOrderRow } from '@/lib/admin/forex-api';
import { ForexAdminOpsTable } from '@/components/forex/ForexAdminOpsTable';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import { ForexSectionLabel, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';

const PROTECTION_TYPE = /stop|take|trail|protection|sl|tp/i;

function fmtTime(s: string): string {
  try {
    return new Date(s).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return s;
  }
}

function SideBadge({ side }: { side: string }) {
  const buyish = side === 'buy' || side === 'long';
  return (
    <Badge variant={buyish ? 'success' : 'danger'} className="text-[9px] font-normal uppercase">
      {side}
    </Badge>
  );
}

export function ForexProtectionPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);

  const ordersQ = useQuery({
    queryKey: ['admin', 'forex', 'protection-orders', token],
    queryFn: async () => {
      const res = await getForexAdminOrders(token, { page: 1, limit: 100 });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data.rows.filter((r) => PROTECTION_TYPE.test(r.order_type));
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const columns = useMemo<ColumnDef<ForexAdminOrderRow>[]>(
    () => [
      { accessorKey: 'created_at', header: 'Time', cell: ({ getValue }) => fmtTime(String(getValue())) },
      { accessorKey: 'symbol', header: 'Symbol', cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span> },
      { accessorKey: 'order_type', header: 'Protection type' },
      { accessorKey: 'side', header: 'Side', cell: ({ getValue }) => <SideBadge side={String(getValue())} /> },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const st = String(getValue()).toUpperCase();
          const variant = st === 'FILLED' || st === 'ACTIVE' ? 'success' : st === 'REJECTED' || st === 'FAILED' ? 'danger' : 'info';
          return <Badge variant={variant}>{st}</Badge>;
        },
      },
      { accessorKey: 'requested_price', header: 'Trigger / price', cell: ({ getValue }) => getValue() ?? '—' },
      { accessorKey: 'requested_volume', header: 'Volume' },
      {
        accessorKey: 'account_id',
        header: 'Account',
        cell: ({ getValue }) => (
          <Link href={`/forex/accounts?account=${encodeURIComponent(String(getValue()))}`} className="font-mono text-xs text-violet-400 hover:underline">
            {String(getValue()).slice(0, 8)}…
          </Link>
        ),
      },
    ],
    [],
  );

  const rows = ordersQ.data ?? [];
  const pending = rows.filter((r) => !['FILLED', 'REJECTED', 'CANCELLED', 'FAILED'].includes(r.status.toUpperCase())).length;
  const symbols = new Set(rows.map((r) => r.symbol)).size;

  return (
    <div className="space-y-4">
      <ForexWorkspaceHeader
        title="Protection"
        purpose="SL & TP, pending protection orders, modify limits, and triggers — cross-check open positions for inline SL/TP."
        dataSource="Admin Forex API · orders filter (protection types)"
        posture="MOCK"
        kpis={[
          { label: 'Protection orders (batch)', value: String(rows.length) },
          { label: 'Non-terminal', value: String(pending), tone: pending > 0 ? 'warning' : undefined },
          { label: 'Symbols', value: String(symbols) },
          { label: 'Order book', value: 'Trading → Orders' },
        ]}
      />

      <div className="flex flex-wrap gap-2 text-[10px]">
        <Link href="/forex/orders" className="rounded-md border border-admin-border/60 px-2 py-1 hover:border-violet-500/40">
          Orders
        </Link>
        <Link href="/forex/positions" className="rounded-md border border-admin-border/60 px-2 py-1 hover:border-violet-500/40">
          Positions
        </Link>
        <Link href="/forex/dealing" className="rounded-md border border-admin-border/60 px-2 py-1 hover:border-violet-500/40">
          Dealing desk
        </Link>
      </div>

      <ForexWorkspaceSurface noPadding>
        <div className="border-b border-admin-border px-4 py-3">
          <ForexSectionLabel icon={Shield}>Protection orders · latest batch</ForexSectionLabel>
          <p className="mt-1 text-[11px] text-admin-muted">
            Stop loss, take profit, trailing, and related order types. Client tickets may attach SL/TP on positions without a separate protection order row.
          </p>
        </div>
        {ordersQ.isLoading ? (
          <p className="px-4 py-6 text-sm text-admin-muted">Loading protection orders…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-admin-muted">
            No protection-type orders in the latest batch. Review open positions below for live SL/TP on tickets.
          </p>
        ) : (
          <DataTable columns={columns} data={rows} compact sortable={false} />
        )}
      </ForexWorkspaceSurface>

      <ForexWorkspaceSurface className="border-violet-500/20 bg-violet-500/[0.03]">
        <ForexSectionLabel>Open positions · inline SL / TP</ForexSectionLabel>
        <p className="mb-3 text-[11px] text-admin-muted">
          Hedging/netting exposure with stop and take-profit fields from the position record. Filter and export on the dedicated Positions workspace.
        </p>
      </ForexWorkspaceSurface>

      <ForexAdminOpsTable kind="positions" layout="section" />
    </div>
  );
}
