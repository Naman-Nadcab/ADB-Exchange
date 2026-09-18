'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminAudit,
  getForexAdminJournal,
  downloadForexAdminCsv,
  type ForexAdminAuditRow,
  type ForexAdminJournalRow,
} from '@/lib/admin/forex-api';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { Download, RefreshCw } from 'lucide-react';

export function ForexJournalAuditPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const searchParams = useSearchParams();
  const [accountId, setAccountId] = useState('');
  const [journalPage, setJournalPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const ac = searchParams.get('account_id')?.trim();
    if (ac) {
      setAccountId(ac);
      setJournalPage(1);
    }
  }, [searchParams]);

  const journalQ = useQuery({
    queryKey: ['admin', 'forex', 'journal', token, accountId, journalPage],
    queryFn: async () => {
      const res = await getForexAdminJournal(token, {
        page: journalPage,
        limit: 25,
        account_id: accountId.trim() || undefined,
      });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 10_000,
  });

  const auditQ = useQuery({
    queryKey: ['admin', 'forex', 'audit', token, auditPage],
    queryFn: async () => {
      const res = await getForexAdminAudit(token, { page: auditPage, limit: 25 });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
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
        accessorKey: 'account_id',
        header: 'Account',
        cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.account_id}</span>,
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => (
          <Badge
            variant={row.original.severity === 'error' ? 'danger' : row.original.severity === 'warn' ? 'warning' : 'default'}
            className="font-normal"
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

  const auditColumns = useMemo<ColumnDef<ForexAdminAuditRow>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: 'Time',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">{new Date(row.original.created_at).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: 'actor_id',
        header: 'Admin',
        cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.actor_id ?? '—'}</span>,
      },
      { accessorKey: 'action', header: 'Action' },
      {
        id: 'resource',
        header: 'Resource',
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.resource_type}/{row.original.resource_id}
          </span>
        ),
      },
      {
        accessorKey: 'new_value',
        header: 'Change',
        cell: ({ row }) => (
          <span className="max-w-xs truncate text-xs text-admin-muted" title={row.original.new_value ?? ''}>
            {row.original.new_value ?? '—'}
          </span>
        ),
      },
    ],
    [],
  );

  const tableReady = journalQ.data?.tableReady ?? false;
  const journalRows = tableReady ? (journalQ.data?.rows ?? []) : [];

  return (
    <div className="space-y-4">
      <ForexPanelShell
        title="Customer journal"
        description="Tail of forex_journal_events · filter by account"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Account ID"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setJournalPage(1);
              }}
              className="h-8 w-44 text-xs"
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => void journalQ.refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${journalQ.isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() => {
                setExportError(null);
                void downloadForexAdminCsv(token, '/forex/journal/export', 'forex-journal.csv', {
                  account_id: accountId.trim() || undefined,
                }).catch((e) => setExportError(e instanceof Error ? e.message : 'Export failed'));
              }}
            >
              <Download className="h-3 w-3" />
              Export CSV
            </Button>
          </div>
        }
        noPadding
      >
        {exportError ? <p className="px-4 pt-4 text-sm text-red-400">{exportError}</p> : null}
        {journalQ.isError ? (
          <p className="p-4 text-sm text-red-400">{journalQ.error instanceof Error ? journalQ.error.message : 'Load failed'}</p>
        ) : !tableReady ? (
          <p className="p-4 text-sm text-admin-muted">
            Journal table not migrated yet. Run backend migrate to create forex_journal_events.
          </p>
        ) : (
          <DataTable columns={journalColumns} data={journalRows} loading={journalQ.isLoading} compact sortable={false} />
        )}
        {journalQ.data && journalQ.data.pagination.totalPages > 1 ? (
          <div className="flex items-center gap-2 border-t border-admin-border px-4 py-3 text-xs">
            <Button type="button" size="sm" variant="secondary" disabled={journalPage <= 1} onClick={() => setJournalPage((p) => p - 1)}>
              Prev
            </Button>
            <span className="text-admin-muted">
              Page {journalPage} / {journalQ.data.pagination.totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={journalPage >= journalQ.data.pagination.totalPages}
              onClick={() => setJournalPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </ForexPanelShell>

      <ForexPanelShell title="Forex config audit" description="Immutable admin change log · audit:view required" noPadding>
        <ProtectedAction
          permission="audit:view"
          fallback={<p className="p-4 text-sm text-admin-muted">Forex config audit requires the audit:view permission.</p>}
        >
          {auditQ.isError ? (
            <p className="p-4 text-sm text-red-400">{auditQ.error instanceof Error ? auditQ.error.message : 'Load failed'}</p>
          ) : (
            <>
              <DataTable columns={auditColumns} data={auditQ.data?.rows ?? []} loading={auditQ.isLoading} compact sortable={false} />
              {auditQ.data && auditQ.data.pagination.totalPages > 1 ? (
                <div className="flex items-center gap-2 border-t border-admin-border px-4 py-3 text-xs">
                  <Button type="button" size="sm" variant="secondary" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}>
                    Prev
                  </Button>
                  <span className="text-admin-muted">
                    Page {auditPage} / {auditQ.data.pagination.totalPages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={auditPage >= auditQ.data.pagination.totalPages}
                    onClick={() => setAuditPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </ProtectedAction>
      </ForexPanelShell>

      <p className="text-xs text-admin-muted">
        Per-user snapshot: user profile → Forex tab.{' '}
        <Link href="/users" className="text-violet-300 hover:underline">
          Users
        </Link>
      </p>
    </div>
  );
}
