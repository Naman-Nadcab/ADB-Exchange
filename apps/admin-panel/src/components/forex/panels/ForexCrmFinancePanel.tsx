'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import {
  downloadForexAdminCsv,
  getForexAdminFinanceAccounts,
  getForexAdminFinanceReconciliation,
  type ForexAdminFinanceAccountRow,
  type ForexAdminFinanceReconciliationRow,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { Download, RefreshCw, Search } from 'lucide-react';

export function ForexCrmFinancePanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [reconPage, setReconPage] = useState(1);
  const [reconAccount, setReconAccount] = useState('');
  const [reconOk, setReconOk] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);

  const accountsQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'finance', 'accounts', token, page, q, accountStatus],
    queryFn: async () => {
      const res = await getForexAdminFinanceAccounts(token, {
        page,
        limit: 50,
        q: q || undefined,
        account_status: accountStatus || undefined,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const reconQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'finance', 'recon', token, reconPage, reconAccount, reconOk],
    queryFn: async () => {
      const res = await getForexAdminFinanceReconciliation(token, {
        page: reconPage,
        limit: 25,
        account_id: reconAccount.trim() || undefined,
        ok: reconOk || undefined,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const accountColumns = useMemo<ColumnDef<ForexAdminFinanceAccountRow>[]>(
    () => [
      {
        accessorKey: 'account_id',
        header: 'Account',
        cell: ({ row }) => (
          <Link
            href={`/forex/crm/finance/${encodeURIComponent(row.original.account_id)}`}
            className="font-mono text-xs text-admin-accent hover:underline"
          >
            {row.original.account_id.slice(0, 8)}…
          </Link>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => row.original.email ?? '—',
      },
      {
        accessorKey: 'customer_cash_balance',
        header: 'Cash balance',
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {row.original.customer_cash_balance} {row.original.currency}
          </span>
        ),
      },
      {
        accessorKey: 'ledger_transaction_count',
        header: 'Ledger txs',
        cell: ({ row }) => <span className="tabular-nums">{row.original.ledger_transaction_count}</span>,
      },
      {
        id: 'last_recon',
        header: 'Last recon',
        cell: ({ row }) =>
          row.original.last_reconciliation_ok == null ? (
            '—'
          ) : (
            <Badge variant={row.original.last_reconciliation_ok ? 'success' : 'danger'} className="text-[10px] font-normal">
              {row.original.last_reconciliation_ok ? 'OK' : 'FAIL'}
            </Badge>
          ),
      },
      {
        accessorKey: 'account_status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant="default" className="text-[10px] font-normal capitalize">
            {row.original.account_status}
          </Badge>
        ),
      },
    ],
    [],
  );

  const reconColumns = useMemo<ColumnDef<ForexAdminFinanceReconciliationRow>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: 'Time',
        cell: ({ getValue }) => new Date(String(getValue())).toLocaleString(),
      },
      {
        accessorKey: 'account_id',
        header: 'Account',
        cell: ({ row }) => (
          <Link
            href={`/forex/crm/finance/${encodeURIComponent(row.original.account_id)}`}
            className="font-mono text-[10px] text-admin-accent hover:underline"
          >
            {row.original.account_id.slice(0, 8)}…
          </Link>
        ),
      },
      { accessorKey: 'kind', header: 'Kind' },
      {
        accessorKey: 'ok',
        header: 'Result',
        cell: ({ row }) => (
          <Badge variant={row.original.ok ? 'success' : 'danger'} className="font-normal text-[10px]">
            {row.original.ok ? 'OK' : 'FAIL'}
          </Badge>
        ),
      },
      { accessorKey: 'reason', header: 'Reason', cell: ({ getValue }) => String(getValue() ?? '—') },
    ],
    [],
  );

  const accountsData = accountsQ.data;
  const reconData = reconQ.data;

  return (
    <div className="admin-stack-lg">
      <ForexPanelShell
        title="Finance desk — ledger accounts"
        description="CUSTOMER_CASH balances and reconciliation posture per forex account"
        actions={
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setExportError(null);
                void downloadForexAdminCsv(
                  token,
                  '/forex/crm/finance/accounts/export',
                  'forex-crm-finance-accounts.csv',
                  { q: q || undefined, account_status: accountStatus || undefined },
                ).catch((e) => setExportError(e instanceof Error ? e.message : 'Export failed'));
              }}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Accounts CSV
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void accountsQ.refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${accountsQ.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      >
        <form
          className="mb-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(qInput.trim());
          }}
        >
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-admin-muted" />
            <Input
              className="pl-8"
              placeholder="Account, user id, email…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
          <select
            className="h-9 rounded-md border border-admin-border/60 bg-admin-surface px-2 text-xs"
            value={accountStatus}
            onChange={(e) => {
              setPage(1);
              setAccountStatus(e.target.value);
            }}
            aria-label="Account status"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </form>
        {exportError ? <p className="mb-2 text-xs text-red-400">{exportError}</p> : null}
        {accountsData?.note ? <p className="mb-3 text-xs text-admin-muted">{accountsData.note}</p> : null}
        {accountsQ.isError ? (
          <p className="text-sm text-red-400">{accountsQ.error instanceof Error ? accountsQ.error.message : 'Load failed'}</p>
        ) : (
          <>
            <DataTable columns={accountColumns} data={accountsData?.rows ?? []} loading={accountsQ.isLoading} />
            {accountsData?.pagination && accountsData.pagination.totalPages > 1 ? (
              <div className="mt-3 flex justify-between text-xs text-admin-muted">
                <span>
                  Page {accountsData.pagination.page} of {accountsData.pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={page >= accountsData.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </ForexPanelShell>

      <ForexPanelShell
        title="Reconciliation events"
        description="Latest forex ledger reconciliation tail (read-only)"
        actions={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              void downloadForexAdminCsv(
                token,
                '/forex/crm/finance/reconciliation/export',
                'forex-crm-finance-reconciliation.csv',
                {
                  account_id: reconAccount.trim() || undefined,
                  ok: reconOk || undefined,
                },
              );
            }}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Recon CSV
          </Button>
        }
        noPadding
      >
        <div className="flex flex-wrap gap-2 border-b border-admin-border/60 px-4 py-3">
          <Input
            className="max-w-xs font-mono text-xs"
            placeholder="Filter account_id"
            value={reconAccount}
            onChange={(e) => {
              setReconPage(1);
              setReconAccount(e.target.value);
            }}
          />
          <select
            className="h-9 rounded-md border border-admin-border/60 bg-admin-surface px-2 text-xs"
            value={reconOk}
            onChange={(e) => {
              setReconPage(1);
              setReconOk(e.target.value);
            }}
          >
            <option value="">All results</option>
            <option value="yes">OK only</option>
            <option value="no">Failed only</option>
          </select>
        </div>
        {!reconData?.tableReady ? (
          <p className="p-4 text-sm text-admin-muted">Reconciliation table not provisioned.</p>
        ) : reconQ.isError ? (
          <p className="p-4 text-sm text-red-400">{reconQ.error instanceof Error ? reconQ.error.message : 'Load failed'}</p>
        ) : (
          <>
            <DataTable columns={reconColumns} data={reconData?.rows ?? []} loading={reconQ.isLoading} compact />
            {reconData?.pagination && reconData.pagination.totalPages > 1 ? (
              <div className="flex justify-between border-t border-admin-border/60 px-4 py-3 text-xs text-admin-muted">
                <span>
                  Page {reconData.pagination.page} of {reconData.pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={reconPage <= 1}
                    onClick={() => setReconPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={reconPage >= reconData.pagination.totalPages}
                    onClick={() => setReconPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </ForexPanelShell>
    </div>
  );
}
