'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexDeskPolicy, patchForexDeskPolicy, type ForexDeskPolicy } from '@/lib/admin/forex-api';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ForexConfirmModal } from '@/components/forex/primitives/ForexConfirmModal';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';

const ORDER_KEYS = ['market', 'limit', 'stop', 'stop_limit'] as const;
const TIF_KEYS = ['GTC', 'DAY', 'IOC', 'FOK'] as const;

export function ForexDeskPolicyPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ForexDeskPolicy | null>(null);
  const [confirm, setConfirm] = useState(false);

  const q = useQuery({
    queryKey: ['admin', 'forex', 'desk-policy', token],
    queryFn: async () => {
      const res = await getForexDeskPolicy(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const saveM = useMutation({
    mutationFn: async (reason: string) => {
      if (!draft) throw new Error('Policy not loaded');
      const res = await patchForexDeskPolicy(token, {
        reason,
        bookMode: draft.bookMode,
        orderPolicy: draft.orderPolicy,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Save failed');
      return res.data;
    },
    onSuccess: () => {
      setConfirm(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'forex'] });
    },
  });

  if (!draft) return <p className="text-sm text-admin-muted">Loading desk policy…</p>;

  const toggle = (key: keyof ForexDeskPolicy['orderPolicy']) => {
    setDraft((d) => (d ? { ...d, orderPolicy: { ...d.orderPolicy, [key]: !d.orderPolicy[key] } } : d));
  };

  return (
    <ForexPanelShell
      title="LP-ready desk policy"
      description="Order types, time in force, and book mode are saved. Customer fills stay simulated until the broker is healthy."
      actions={<Badge variant="info" className="font-normal">Fills {draft.fills}</Badge>}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="text-xs text-admin-muted">
          Book mode
          <select
            value={draft.bookMode}
            onChange={(e) => setDraft((d) => (d ? { ...d, bookMode: e.target.value as ForexDeskPolicy['bookMode'] } : d))}
            className="mt-1 h-9 w-full rounded border border-admin-border bg-admin-bg px-2 text-sm"
          >
            <option value="B_BOOK">B_BOOK</option>
            <option value="A_BOOK">A_BOOK</option>
            <option value="HYBRID">HYBRID</option>
          </select>
        </label>
        <div>
          <p className="text-xs text-admin-muted">Customer order types</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {ORDER_KEYS.map((key) => (
              <Button key={key} type="button" size="sm" variant={draft.orderPolicy[key] ? 'primary' : 'outline'} className="h-8 text-xs" onClick={() => toggle(key)}>
                {key}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-admin-muted">Time in force</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {TIF_KEYS.map((key) => (
              <Button key={key} type="button" size="sm" variant={draft.orderPolicy[key] ? 'primary' : 'outline'} className="h-8 text-xs" onClick={() => toggle(key)}>
                {key}
              </Button>
            ))}
            <Button type="button" size="sm" variant={draft.orderPolicy.dayExpiry ? 'primary' : 'outline'} className="h-8 text-xs" onClick={() => toggle('dayExpiry')}>
              DAY expiry
            </Button>
          </div>
        </div>
      </div>
      <ProtectedAction permission="forex:control" fallback="disabled">
        <Button type="button" size="sm" className="mt-3" onClick={() => setConfirm(true)}>
          Save desk policy
        </Button>
      </ProtectedAction>
      {saveM.isError ? <p className="mt-2 text-sm text-red-400">{saveM.error instanceof Error ? saveM.error.message : 'Save failed'}</p> : null}
      <ForexConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Save desk policy"
        description={`Book ${draft.bookMode}. Fills remain MOCK until the LP gateway is healthy.`}
        loading={saveM.isPending}
        onConfirm={async (reason) => {
          await saveM.mutateAsync(reason);
        }}
      />
    </ForexPanelShell>
  );
}
