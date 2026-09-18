'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminFinanceAccountDetail } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export function ForexCrmFinanceAccountPanel({ accountId }: { accountId: string }) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const q = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'finance', 'account', accountId, token],
    queryFn: async () => {
      const res = await getForexAdminFinanceAccountDetail(token, accountId);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Not found');
      return res.data;
    },
    enabled: !!token && !!accountId,
    staleTime: 15_000,
  });

  const d = q.data;

  return (
    <div className="admin-stack-lg">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/forex/crm/finance"
          className="inline-flex h-8 items-center rounded-md px-2 text-sm text-admin-muted hover:bg-admin-surface hover:text-admin-fg"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Finance desk
        </Link>
        <Button type="button" size="sm" variant="ghost" onClick={() => void q.refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {q.isLoading ? (
        <ForexPanelShell title="Finance">
          <p className="text-sm text-admin-muted">Loading…</p>
        </ForexPanelShell>
      ) : q.isError ? (
        <ForexPanelShell title="Finance">
          <p className="text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Load failed'}</p>
        </ForexPanelShell>
      ) : d ? (
        <>
          <ForexPanelShell
            title={d.account_id}
            description="Ledger finance detail · read-only"
            actions={
              <Link href={d.shortcuts.crm_client_path} className="text-xs text-admin-accent hover:underline">
                CRM client profile
              </Link>
            }
          >
            <ForexDetailGrid
              items={[
                { label: 'Email', value: d.email ?? '—' },
                { label: 'Cash balance', value: `${d.customer_cash_balance} ${d.currency}`, highlight: 'success' },
                { label: 'Account status', value: d.account_status },
                {
                  label: 'Ledger',
                  value: (
                    <Link href={d.shortcuts.ledger_path} className="text-admin-accent hover:underline">
                      Full ledger view
                    </Link>
                  ),
                },
                {
                  label: 'Journal',
                  value: (
                    <Link href={d.shortcuts.journal_path} className="text-admin-accent hover:underline">
                      Filter journal
                    </Link>
                  ),
                },
              ]}
            />
          </ForexPanelShell>

          <ForexPanelShell title="Recent ledger transactions" description="CUSTOMER_CASH delta per posted transaction">
            {d.recent_transactions.length === 0 ? (
              <p className="text-sm text-admin-muted">No ledger transactions.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {d.recent_transactions.map((tx) => (
                  <li key={tx.transaction_id} className="rounded-md border border-admin-border/60 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info" className="text-[10px] font-normal">
                        {tx.type}
                      </Badge>
                      <Badge variant="default" className="text-[10px] font-normal">
                        {tx.status}
                      </Badge>
                      <span className="tabular-nums font-medium">
                        Δ {tx.customer_cash_delta} {tx.currency}
                      </span>
                      <span className="text-[10px] text-admin-muted">{new Date(tx.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-admin-muted">{tx.transaction_id}</p>
                  </li>
                ))}
              </ul>
            )}
          </ForexPanelShell>

          <ForexPanelShell title="Recent reconciliation">
            {d.recent_reconciliation.length === 0 ? (
              <p className="text-sm text-admin-muted">No reconciliation rows for this account.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {d.recent_reconciliation.map((e) => (
                  <li key={e.event_id} className="flex flex-wrap items-center gap-2 rounded-md border border-admin-border/60 px-3 py-2">
                    <Badge variant={e.ok ? 'success' : 'danger'} className="text-[10px] font-normal">
                      {e.kind}
                    </Badge>
                    <span className="text-xs">{e.reason ?? e.detail ?? '—'}</span>
                    <span className="text-[10px] text-admin-muted">{new Date(e.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </ForexPanelShell>
        </>
      ) : null}
    </div>
  );
}
