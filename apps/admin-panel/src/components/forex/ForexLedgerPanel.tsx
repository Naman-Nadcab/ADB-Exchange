'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminLedger } from '@/lib/admin/forex-api';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <span className="text-sm font-medium">Forex ledger accounts (CUSTOMER_CASH)</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => void q.refetch()}>
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {q.isError ? (
            <p className="text-sm text-red-400">{q.error instanceof Error ? q.error.message : 'Load failed'}</p>
          ) : !data?.accounts.length ? (
            <p className="text-sm text-admin-muted">No forex_accounts rows.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-admin-border text-admin-muted">
                    <th className="py-2 pr-2">Account</th>
                    <th className="py-2 pr-2">User</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Currency</th>
                    <th className="py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a) => (
                    <tr key={a.account_id} className="border-b border-admin-border/50">
                      <td className="py-2 pr-2 font-mono">{a.account_id}</td>
                      <td className="py-2 pr-2 font-mono text-[11px]">{a.user_id ?? '—'}</td>
                      <td className="py-2 pr-2">
                        <Badge variant={a.status === 'active' ? 'success' : 'warning'} className="font-normal">
                          {a.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-2">{a.currency}</td>
                      <td className="py-2 font-medium">{a.customer_cash_balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 text-sm font-medium">Reconciliation events (latest)</CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-admin-muted">{data?.note}</p>
          {!data?.reconciliation.length ? (
            <p className="text-sm text-admin-muted">No reconciliation events recorded.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {data.reconciliation.map((e) => (
                <li key={e.event_id} className="rounded border border-admin-border/60 px-2 py-1.5">
                  <span className="text-admin-muted">{new Date(e.created_at).toLocaleString()}</span>{' '}
                  <Badge variant={e.ok ? 'success' : 'danger'} className="mx-1 font-normal">
                    {e.kind}
                  </Badge>
                  {e.account_id} — {e.reason ?? e.detail ?? (e.ok ? 'ok' : 'fail')}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
