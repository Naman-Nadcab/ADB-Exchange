'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminLedger } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { RefreshCw } from 'lucide-react';

type AccountRow = {
  account_id: string;
  user_id: string | null;
  status: string;
  currency: string;
  customer_cash_balance: string;
};

export function ForexLedgerPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const q = useQuery({
    queryKey: ['admin', 'forex', 'ledger', token],
    queryFn: async () => {
      const res = await getForexAdminLedger(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const data = q.data;
  const accounts = data?.accounts ?? [];

  const columns = useMemo<ColumnDef<AccountRow>[]>(
    () => [
      {
        accessorKey: 'account_id',
        header: 'Account',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.account_id}</span>,
      },
      {
        accessorKey: 'user_id',
        header: 'User',
        cell: ({ row }) => <span className="font-mono text-[11px] text-admin-muted">{row.original.user_id ?? '—'}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'success' : 'warning'} className="font-normal capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      { accessorKey: 'currency', header: 'CCY' },
      {
        accessorKey: 'customer_cash_balance',
        header: 'Balance',
        cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.customer_cash_balance}</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <ForexPanelShell
        title="Forex ledger accounts"
        description="Customer cash (CUSTOMER_CASH) · isolated from crypto wallets"
        actions={
          <Button type="button" size="sm" variant="ghost" onClick={() => void q.refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        }
        noPadding
      >
        {q.isError ? (
          <p className="p-4 text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Load failed'}</p>
        ) : (
          <DataTable columns={columns} data={accounts as AccountRow[]} loading={q.isLoading} sortable compact />
        )}
      </ForexPanelShell>

      <ForexPanelShell title="Reconciliation events" description={data?.note}>
        {!data?.reconciliation.length ? (
          <p className="text-sm text-admin-muted">No reconciliation events recorded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.reconciliation.map((e) => (
              <li
                key={e.event_id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-admin-border/60 px-3 py-2"
              >
                <span className="text-xs text-admin-muted">{new Date(e.created_at).toLocaleString()}</span>
                <Badge variant={e.ok ? 'success' : 'danger'} className="font-normal">
                  {e.kind}
                </Badge>
                <span className="font-mono text-xs">{e.account_id}</span>
                <span className="text-admin-muted">{e.reason ?? e.detail ?? (e.ok ? 'OK' : 'Failed')}</span>
              </li>
            ))}
          </ul>
        )}
      </ForexPanelShell>
    </div>
  );
}
