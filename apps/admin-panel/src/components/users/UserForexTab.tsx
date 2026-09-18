'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { getForexAdminUserSummary, type ForexAdminJournalRow } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexEmptyState } from '@/components/forex/primitives/ForexEmptyState';
import { ForexMetricTile } from '@/components/forex/primitives/ForexMetricTile';
import { KpiSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { ArrowRight, Layers, LineChart, ShoppingCart } from 'lucide-react';

export function UserForexTab(props: { userId: string; token: string | null }) {
  const q = useQuery({
    queryKey: ['admin', 'forex', 'user-summary', props.token, props.userId],
    queryFn: async () => {
      const res = await getForexAdminUserSummary(props.token, props.userId);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!props.token && !!props.userId,
    staleTime: 15_000,
  });

  const journalColumns = useMemo<ColumnDef<ForexAdminJournalRow>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: 'Time',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">{new Date(row.original.created_at).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => (
          <Badge
            variant={row.original.severity === 'error' ? 'danger' : row.original.severity === 'warn' ? 'warning' : 'default'}
            className="font-normal text-[10px]"
          >
            {row.original.severity}
          </Badge>
        ),
      },
      { accessorKey: 'event_type', header: 'Type' },
      { accessorKey: 'message', header: 'Message' },
    ],
    [],
  );

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <KpiSkeleton count={3} />
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }

  if (q.isError) {
    return <p className="text-sm text-red-500">{q.error instanceof Error ? q.error.message : 'Failed to load'}</p>;
  }

  const data = q.data!;

  if (!data.accounts.length) {
    return (
      <ForexEmptyState
        title="No Forex accounts"
        description="This user has no Forex ledger accounts yet. Demo onboarding uses the isolated Forex ledger while live money path remains blocked."
        icon={LineChart}
        action={
          <Link href="/forex/accounts">
            <Button type="button" variant="secondary" size="sm">
              Browse Forex accounts
            </Button>
          </Link>
        }
      />
    );
  }

  const totalOrders = data.accounts.reduce((s, a) => s + a.open_orders, 0);
  const totalPositions = data.accounts.reduce((s, a) => s + a.open_positions, 0);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <ForexMetricTile label="Forex accounts" value={data.accounts.length} icon={LineChart} />
        <ForexMetricTile label="Open orders" value={totalOrders} icon={ShoppingCart} />
        <ForexMetricTile label="Open positions" value={totalPositions} icon={Layers} />
      </section>

      {data.accounts.map((acct) => (
        <ForexPanelShell
          key={acct.account_id}
          title={acct.account_id}
          description={`${acct.currency} · customer ledger`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Badge variant={acct.status === 'active' ? 'success' : 'warning'} className="font-normal capitalize">
                {acct.status}
              </Badge>
              <Link href="/forex/orders">
                <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs">
                  Orders
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link href="/forex/positions">
                <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs">
                  Positions
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          }
        >
          <p className="text-sm text-admin-muted">
            Open orders: <strong className="text-foreground">{acct.open_orders}</strong> · Open positions:{' '}
            <strong className="text-foreground">{acct.open_positions}</strong>
          </p>
        </ForexPanelShell>
      ))}

      <ForexPanelShell title="Recent journal" description="Last 15 events for this user&apos;s accounts" noPadding>
        {!data.journalTableReady ? (
          <ForexEmptyState
            title="Journal not available"
            description="Run backend migrate to create forex_journal_events."
            className="border-0 bg-transparent py-8"
          />
        ) : !data.recentJournal.length ? (
          <ForexEmptyState title="No journal events" description="Activity will appear here as the customer trades." className="border-0 bg-transparent py-8" />
        ) : (
          <DataTable columns={journalColumns} data={data.recentJournal} compact sortable={false} />
        )}
        <div className="border-t border-admin-border px-4 py-3">
          <Link href="/forex/journal-audit" className="text-xs font-medium text-violet-300 hover:underline">
            Open full Journal &amp; Audit →
          </Link>
        </div>
      </ForexPanelShell>
    </div>
  );
}
