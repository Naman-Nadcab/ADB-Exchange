'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAdminAuthStore } from '@/store/auth';
import {
  getForexAdminAudit,
  getForexAdminJournal,
  type ForexAdminAuditRow,
  type ForexAdminJournalRow,
} from '@/lib/admin/forex-api';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

function JournalTable(props: { rows: ForexAdminJournalRow[]; tableReady: boolean }) {
  if (!props.tableReady) {
    return (
      <p className="text-sm text-admin-muted">
        Journal table not migrated yet. Run backend migrate to create <code className="text-xs">forex_journal_events</code>.
      </p>
    );
  }
  if (!props.rows.length) {
    return <p className="text-sm text-admin-muted">No journal events in this page.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead>
          <tr className="border-b border-admin-border text-admin-muted">
            <th className="py-2 pr-2">Time</th>
            <th className="py-2 pr-2">Account</th>
            <th className="py-2 pr-2">Severity</th>
            <th className="py-2 pr-2">Type</th>
            <th className="py-2">Message</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r) => (
            <tr key={r.id} className="border-b border-admin-border/50 align-top">
              <td className="py-2 pr-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
              <td className="py-2 pr-2 font-mono text-[11px]">{r.account_id}</td>
              <td className="py-2 pr-2">
                <Badge variant={r.severity === 'error' ? 'danger' : r.severity === 'warn' ? 'warning' : 'default'} className="font-normal">
                  {r.severity}
                </Badge>
              </td>
              <td className="py-2 pr-2">{r.event_type}</td>
              <td className="py-2">{r.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTable(props: { rows: ForexAdminAuditRow[] }) {
  if (!props.rows.length) {
    return <p className="text-sm text-admin-muted">No Forex admin audit entries on this page.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-xs">
        <thead>
          <tr className="border-b border-admin-border text-admin-muted">
            <th className="py-2 pr-2">Time</th>
            <th className="py-2 pr-2">Admin</th>
            <th className="py-2 pr-2">Action</th>
            <th className="py-2 pr-2">Resource</th>
            <th className="py-2">Change</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((r, i) => (
            <tr key={`${r.created_at}-${i}`} className="border-b border-admin-border/50 align-top">
              <td className="py-2 pr-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
              <td className="py-2 pr-2 font-mono text-[11px]">{r.actor_id ?? '—'}</td>
              <td className="py-2 pr-2">{r.action}</td>
              <td className="py-2 pr-2">
                {r.resource_type}/{r.resource_id}
              </td>
              <td className="py-2 max-w-md truncate" title={r.new_value ?? ''}>
                {r.new_value ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ForexJournalAuditPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const [accountId, setAccountId] = useState('');
  const [journalPage, setJournalPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <span className="text-sm font-medium">Customer journal tail</span>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Filter account_id"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setJournalPage(1);
              }}
              className="h-8 w-48 text-xs"
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => void journalQ.refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${journalQ.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {journalQ.isError ? (
            <p className="text-sm text-red-500">{journalQ.error instanceof Error ? journalQ.error.message : 'Load failed'}</p>
          ) : (
            <>
              <JournalTable rows={journalQ.data?.rows ?? []} tableReady={journalQ.data?.tableReady ?? false} />
              {journalQ.data && journalQ.data.pagination.totalPages > 1 ? (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={journalPage <= 1}
                    onClick={() => setJournalPage((p) => p - 1)}
                  >
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
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <span className="text-sm font-medium">Forex config audit (immutable log)</span>
          <Badge variant="info" className="font-normal text-[10px]">
            Requires audit:view
          </Badge>
        </CardHeader>
        <CardContent>
          {auditQ.isError ? (
            <p className="text-sm text-red-500">{auditQ.error instanceof Error ? auditQ.error.message : 'Load failed'}</p>
          ) : (
            <>
              <AuditTable rows={auditQ.data?.rows ?? []} />
              {auditQ.data && auditQ.data.pagination.totalPages > 1 ? (
                <div className="mt-3 flex items-center gap-2 text-xs">
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
        </CardContent>
      </Card>

      <p className="text-xs text-admin-muted">
        User-level Forex snapshot: open a user profile → <strong>Forex</strong> tab. Full journal filter:{' '}
        <Link href="/forex/journal-audit" className="text-primary underline">
          Journal &amp; Audit
        </Link>
        .
      </p>
    </div>
  );
}
