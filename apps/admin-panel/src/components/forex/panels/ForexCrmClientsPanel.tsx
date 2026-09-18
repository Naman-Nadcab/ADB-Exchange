'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAdminAuthStore } from '@/store/auth';
import {
  downloadForexAdminCsv,
  getForexAdminCrmClients,
  type ForexAdminCrmClientRow,
} from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { RiskBadge } from '@/components/users/RiskBadge';
import { Download, ExternalLink, RefreshCw, Search } from 'lucide-react';

function kycBadge(status: string | null, level: number | null) {
  if (!status) {
    return (
      <Badge variant="default" className="text-[10px] font-normal">
        No KYC
      </Badge>
    );
  }
  const variant =
    status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : status === 'pending' ? 'warning' : 'info';
  return (
    <Badge variant={variant} className="text-[10px] font-normal capitalize">
      {status}
      {level != null ? ` · L${level}` : ''}
    </Badge>
  );
}

export function ForexCrmClientsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [hasOpenPositions, setHasOpenPositions] = useState('');
  const [kycStatus, setKycStatus] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);

  const exportParams = useMemo(
    () => ({
      q: q || undefined,
      account_status: accountStatus || undefined,
      user_status: userStatus || undefined,
      has_open_positions: hasOpenPositions || undefined,
      kyc_status: kycStatus || undefined,
      risk_level: riskLevel || undefined,
    }),
    [q, accountStatus, userStatus, hasOpenPositions, kycStatus, riskLevel],
  );

  const qry = useQuery({
    queryKey: [
      'admin',
      'forex',
      'crm',
      'clients',
      token,
      page,
      q,
      accountStatus,
      userStatus,
      hasOpenPositions,
      kycStatus,
      riskLevel,
    ],
    queryFn: async () => {
      const res = await getForexAdminCrmClients(token, {
        page,
        limit: 50,
        q: q || undefined,
        account_status: accountStatus || undefined,
        user_status: userStatus || undefined,
        has_open_positions: hasOpenPositions || undefined,
        kyc_status: kycStatus || undefined,
        risk_level: riskLevel || undefined,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const columns = useMemo<ColumnDef<ForexAdminCrmClientRow>[]>(
    () => [
      {
        accessorKey: 'account_id',
        header: 'Forex account',
        cell: ({ row }) => (
          <Link
            href={`/forex/crm/clients/${encodeURIComponent(row.original.account_id)}`}
            className="font-mono text-xs text-admin-accent hover:underline"
          >
            {row.original.account_id}
          </Link>
        ),
      },
      {
        id: 'user',
        header: 'Platform user',
        cell: ({ row }) => {
          const id = row.original.user_id;
          const label = row.original.email ?? row.original.phone ?? id.slice(0, 8);
          return (
            <Link
              href={`/users/${id}`}
              className="inline-flex items-center gap-1 text-sm text-admin-accent hover:underline"
            >
              <span className="max-w-[180px] truncate">{label}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
            </Link>
          );
        },
      },
      {
        id: 'kyc',
        header: 'KYC',
        cell: ({ row }) => kycBadge(row.original.kyc_status, row.original.kyc_level),
      },
      {
        id: 'risk',
        header: 'Risk',
        cell: ({ row }) => (
          <RiskBadge level={row.original.risk_level} flags={row.original.risk_flags} className="scale-90 origin-left" />
        ),
      },
      {
        accessorKey: 'user_status',
        header: 'User status',
        cell: ({ row }) =>
          row.original.user_status ? (
            <Badge variant="default" className="font-normal capitalize text-[10px]">
              {row.original.user_status}
            </Badge>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'account_status',
        header: 'Account',
        cell: ({ row }) => (
          <Badge
            variant={row.original.account_status.toUpperCase() === 'ACTIVE' ? 'success' : 'warning'}
            className="font-normal capitalize text-[10px]"
          >
            {row.original.account_status}
          </Badge>
        ),
      },
      {
        accessorKey: 'customer_cash_balance',
        header: 'Cash (USD)',
        cell: ({ row }) => <span className="tabular-nums font-medium">{row.original.customer_cash_balance}</span>,
      },
      {
        accessorKey: 'open_positions',
        header: 'Open pos.',
        cell: ({ row }) => <span className="tabular-nums">{row.original.open_positions}</span>,
      },
    ],
    [],
  );

  const data = qry.data;
  const pagination = data?.pagination;

  return (
    <div className="admin-stack-lg">
      <ForexPanelShell
        title="Forex CRM — clients"
        description="Ledger-backed trading accounts linked to platform users. Open a user profile for the Forex tab and journal."
        actions={
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setExportError(null);
                void downloadForexAdminCsv(token, '/forex/crm/clients/export', 'forex-crm-clients.csv', exportParams).catch(
                  (e) => setExportError(e instanceof Error ? e.message : 'Export failed'),
                );
              }}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              CSV
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void qry.refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${qry.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      >
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(qInput.trim());
          }}
        >
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-admin-muted" />
            <Input
              className="pl-8"
              placeholder="Search account, user id, email, phone…"
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
            aria-label="Account status filter"
          >
            <option value="">All account statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
          <select
            className="h-9 rounded-md border border-admin-border/60 bg-admin-surface px-2 text-xs"
            value={userStatus}
            onChange={(e) => {
              setPage(1);
              setUserStatus(e.target.value);
            }}
            aria-label="User status filter"
          >
            <option value="">All user statuses</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="banned">banned</option>
            <option value="pending">pending</option>
          </select>
          <select
            className="h-9 rounded-md border border-admin-border/60 bg-admin-surface px-2 text-xs"
            value={hasOpenPositions}
            onChange={(e) => {
              setPage(1);
              setHasOpenPositions(e.target.value);
            }}
            aria-label="Open positions filter"
          >
            <option value="">Any positions</option>
            <option value="yes">Has open positions</option>
            <option value="no">No open positions</option>
          </select>
          <select
            className="h-9 rounded-md border border-admin-border/60 bg-admin-surface px-2 text-xs"
            value={kycStatus}
            onChange={(e) => {
              setPage(1);
              setKycStatus(e.target.value);
            }}
            aria-label="KYC status filter"
          >
            <option value="">All KYC</option>
            <option value="none">No application</option>
            <option value="approved">approved</option>
            <option value="pending">pending</option>
            <option value="under_review">under_review</option>
            <option value="rejected">rejected</option>
          </select>
          <select
            className="h-9 rounded-md border border-admin-border/60 bg-admin-surface px-2 text-xs"
            value={riskLevel}
            onChange={(e) => {
              setPage(1);
              setRiskLevel(e.target.value);
            }}
            aria-label="Risk level filter"
          >
            <option value="">All risk</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </form>
        {exportError ? <p className="mt-3 text-xs text-red-400">{exportError}</p> : null}
        {data?.note ? <p className="mt-3 text-xs text-admin-muted">{data.note}</p> : null}
      </ForexPanelShell>

      <ForexPanelShell title="Client accounts" noPadding>
        {qry.isLoading ? (
          <p className="p-6 text-sm text-admin-muted">Loading clients…</p>
        ) : qry.isError ? (
          <p className="p-6 text-sm text-red-400">{qry.error instanceof Error ? qry.error.message : 'Load failed'}</p>
        ) : (
          <>
            <DataTable columns={columns} data={data?.rows ?? []} />
            {pagination && pagination.totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-admin-border/60 px-4 py-3 text-xs text-admin-muted">
                <span>
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} accounts
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={page >= pagination.totalPages}
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
    </div>
  );
}
