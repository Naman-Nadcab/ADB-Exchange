'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getForexAdminUserSummary } from '@/lib/admin/forex-api';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

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

  if (q.isLoading) return <p className="text-sm text-admin-muted">Loading Forex accounts…</p>;
  if (q.isError) {
    return <p className="text-sm text-red-500">{q.error instanceof Error ? q.error.message : 'Failed to load'}</p>;
  }

  const data = q.data!;
  if (!data.accounts.length) {
    return (
      <p className="text-sm text-admin-muted">
        No Forex ledger accounts linked to this user yet (MOCK / demo path only while REAL_FOREX is off).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {data.accounts.map((acct) => (
        <Card key={acct.account_id}>
          <CardHeader className="flex flex-row flex-wrap items-center gap-2 pb-2">
            <span className="font-mono text-sm">{acct.account_id}</span>
            <Badge variant="default" className="font-normal">
              {acct.currency}
            </Badge>
            <Badge variant={acct.status === 'active' ? 'success' : 'warning'} className="font-normal">
              {acct.status}
            </Badge>
          </CardHeader>
          <CardContent className="text-sm text-admin-muted">
            Open orders: <strong className="text-foreground">{acct.open_orders}</strong> · Open positions:{' '}
            <strong className="text-foreground">{acct.open_positions}</strong>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2 text-sm font-medium">Recent journal (15)</CardHeader>
        <CardContent>
          {!data.journalTableReady ? (
            <p className="text-xs text-admin-muted">Journal table not migrated.</p>
          ) : !data.recentJournal.length ? (
            <p className="text-xs text-admin-muted">No journal rows yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {data.recentJournal.map((e) => (
                <li key={e.id} className="rounded border border-admin-border/60 px-2 py-1.5">
                  <span className="text-admin-muted">{new Date(e.created_at).toLocaleString()}</span>{' '}
                  <Badge variant="default" className="mx-1 font-normal text-[10px]">
                    {e.event_type}
                  </Badge>
                  {e.message}
                </li>
              ))}
            </ul>
          )}
          <Link href="/forex/journal-audit" className="mt-3 inline-block text-xs text-primary underline">
            Open full Journal &amp; Audit
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
