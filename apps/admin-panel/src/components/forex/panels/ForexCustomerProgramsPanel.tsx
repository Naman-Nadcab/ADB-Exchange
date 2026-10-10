'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminPrograms, postForexAdminProgram } from '@/lib/admin/forex-api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';

type Snapshot = {
  managers: Array<{ manager_id: string; display_name: string; style: string; status: string; fee_percent: string; owner_user_id: string | null }>;
  payouts: Array<{ payout_id: string; user_id: string; amount: string; status: string }>;
  rules: Array<{ rule_id: string; kind: string; title: string; enabled: boolean }>;
  appLinks: { android_url?: string; ios_url?: string };
  groups: Array<{ group_id: string; code: string; label: string; book: string | null }>;
  feedback: Array<{ feedback_id: string; user_id: string; message: string; created_at: string }>;
};

export function ForexCustomerProgramsPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [rate, setRate] = useState('10');
  const [androidUrl, setAndroidUrl] = useState('');
  const [iosUrl, setIosUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const qry = useQuery({
    queryKey: ['admin', 'forex', 'programs', token],
    queryFn: async () => {
      const res = await getForexAdminPrograms(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data as Snapshot;
    },
    enabled: !!token,
  });

  const run = useMutation({
    mutationFn: async (args: { path: string; body: Record<string, unknown> }) => {
      const res = await postForexAdminProgram(token, args.path, args.body);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed');
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex', 'programs'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const data = qry.data;

  useEffect(() => {
    if (!data?.appLinks) return;
    setAndroidUrl(data.appLinks.android_url ?? '');
    setIosUrl(data.appLinks.ios_url ?? '');
  }, [data?.appLinks]);

  return (
    <ForexPanelShell title="Customer programs" description="Approve managers, payouts, and rewards. A/B book is set on the group and is not shown to the customer.">
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium">Managers</h3>
        {(data?.managers ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No managers yet.</p> : null}
        <ul className="space-y-2 text-sm">
          {(data?.managers ?? []).map((m) => (
            <li key={m.manager_id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {m.display_name} · {m.style} · {m.status}
              </span>
              <span className="flex gap-2">
                <Button type="button" size="sm" disabled={run.isPending} onClick={() => run.mutate({ path: `/forex/programs/managers/${m.manager_id}`, body: { status: 'APPROVED' } })}>
                  Approve
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ path: `/forex/programs/managers/${m.manager_id}`, body: { status: 'SUSPENDED' } })}>
                  Suspend
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium">Payout requests</h3>
        {(data?.payouts ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No payout requests.</p> : null}
        <ul className="space-y-2 text-sm">
          {(data?.payouts ?? []).map((p) => (
            <li key={p.payout_id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {p.amount} · {p.status}
              </span>
              {p.status === 'PENDING' ? (
                <span className="flex gap-2">
                  <Button type="button" size="sm" disabled={run.isPending} onClick={() => run.mutate({ path: `/forex/programs/payouts/${p.payout_id}`, body: { approve: true } })}>
                    Approve
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ path: `/forex/programs/payouts/${p.payout_id}`, body: { approve: false } })}>
                    Reject
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium">Partner rate</h3>
        <div className="flex flex-wrap gap-2">
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User id" />
          <Input className="w-24" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate %" />
          <Button type="button" disabled={run.isPending} onClick={() => run.mutate({ path: '/forex/programs/partner-rate', body: { userId, ratePercent: Number(rate) } })}>
            Save rate
          </Button>
        </div>
      </section>
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium">Rewards</h3>
        <ul className="space-y-2 text-sm">
          {(data?.rules ?? []).map((r) => (
            <li key={r.rule_id} className="flex items-center justify-between gap-2">
              <span>
                {r.title} · {r.kind} · {r.enabled ? 'open' : 'closed'}
              </span>
              <Button type="button" size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ path: `/forex/programs/rules/${r.rule_id}`, body: { enabled: !r.enabled } })}>
                {r.enabled ? 'Close' : 'Open'}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium">Account group book</h3>
        <p className="mb-2 text-xs text-muted-foreground">Customers see the group name only.</p>
        <ul className="space-y-2 text-sm">
          {(data?.groups ?? []).map((g) => (
            <li key={g.group_id} className="flex items-center justify-between gap-2">
              <span>
                {g.code} · book {g.book ?? 'unset'}
              </span>
              <span className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ path: `/forex/programs/groups/${g.group_id}/book`, body: { book: 'A' } })}>
                  A
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate({ path: `/forex/programs/groups/${g.group_id}/book`, body: { book: 'B' } })}>
                  B
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium">Feedback</h3>
        {(data?.feedback ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No notes yet.</p> : null}
        <ul className="space-y-2 text-sm">
          {(data?.feedback ?? []).map((f) => (
            <li key={f.feedback_id}>
              <p className="text-xs text-muted-foreground">{f.user_id}</p>
              <p>{f.message}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-medium">App links</h3>
        <p className="mb-2 text-xs text-muted-foreground">Leave blank to hide the download buttons.</p>
        <div className="flex max-w-xl flex-col gap-2">
          <Input value={androidUrl} onChange={(e) => setAndroidUrl(e.target.value)} placeholder={data?.appLinks?.android_url || 'Android URL'} />
          <Input value={iosUrl} onChange={(e) => setIosUrl(e.target.value)} placeholder={data?.appLinks?.ios_url || 'iOS URL'} />
          <Button type="button" disabled={run.isPending} onClick={() => run.mutate({ path: '/forex/programs/app-links', body: { androidUrl, iosUrl } })}>
            Save links
          </Button>
        </div>
      </section>
    </ForexPanelShell>
  );
}
