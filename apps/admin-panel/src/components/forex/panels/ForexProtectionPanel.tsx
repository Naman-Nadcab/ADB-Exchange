'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminOrders, type ForexAdminOrderRow } from '@/lib/admin/forex-api';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexAdminOpsTable } from '@/components/forex/ForexAdminOpsTable';
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
      { accessorKey: 'symbol', header: 'Symbol' },
      { accessorKey: 'order_type', header: 'Protection type' },
      { accessorKey: 'side', header: 'Side' },
      { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant="info">{String(getValue())}</Badge> },
      { accessorKey: 'requested_price', header: 'Trigger / price', cell: ({ getValue }) => getValue() ?? '—' },
      { accessorKey: 'requested_volume', header: 'Volume' },
      { accessorKey: 'account_id', header: 'Account', cell: ({ getValue }) => String(getValue()).slice(0, 8) + '…' },
    ],
    [],
  );

  const rows = ordersQ.data ?? [];

  return (
    <div className="admin-stack-lg">
      <ForexPanelShell
        title="Protection orders"
        description="Stop loss, take profit, and trailing orders across all accounts. Full order book: Trading → Orders."
      >
        {ordersQ.isLoading ? (
          <p className="text-sm text-admin-muted">Loading protection orders…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-admin-muted">
            No protection-type orders in the latest batch. Open positions may still carry inline SL/TP from the client
            ticket — check Positions for live risk.
          </p>
        ) : (
          <DataTable columns={columns} data={rows} compact sortable={false} />
        )}
      </ForexPanelShell>

      <ForexAdminOpsTable kind="positions" />
    </div>
  );
}
