'use client';

import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import type { ForexAdminDealingQueueRow } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';

type DealingActionRow = {
  action: string;
  reason: string;
  dealer_admin_id: string;
  result_status: string | null;
  created_at: string;
};

export function ForexDealingOrderDrawer(props: {
  order: ForexAdminDealingQueueRow | null;
  onClose: () => void;
  onAction: (action: 'accept' | 'reject' | 'assign' | 'escalate') => void;
  /** Inline audit strip for dealer workstation (no slide-over chrome). */
  embedded?: boolean;
}) {
  const { order, onClose, onAction, embedded } = props;
  const token = useAdminAuthStore((s) => s.accessToken);

  const actionsQ = useQuery({
    queryKey: ['admin', 'forex', 'dealing', 'actions', order?.order_id, token],
    queryFn: async () => {
      const res = await adminFetch<{ actions: DealingActionRow[] }>(
        `/forex/dealing/orders/${encodeURIComponent(order!.order_id)}/actions`,
        { token },
      );
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data.actions;
    },
    enabled: !!token && !!order?.order_id,
  });

  if (!order) return null;

  const auditBlock = (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-admin-muted">Dealer audit trail</p>
      {actionsQ.isLoading ? (
        <p className="text-xs text-admin-muted">Loading…</p>
      ) : !actionsQ.data?.length ? (
        <p className="text-xs text-admin-muted">No dealer actions recorded.</p>
      ) : (
        <ul className="space-y-2">
          {actionsQ.data.map((a: DealingActionRow, i: number) => (
            <li key={`${a.created_at}-${i}`} className="rounded border border-admin-border/50 px-2 py-1.5 text-xs">
              <Badge variant="default" className="mr-2 text-[10px]">
                {a.action}
              </Badge>
              {a.reason}
              <span className="ml-2 text-admin-muted">{new Date(a.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (embedded) {
    return <div className="p-4">{auditBlock}</div>;
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-admin-border bg-admin-bg shadow-xl">
      <div className="flex items-center justify-between border-b border-admin-border px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-admin-muted">Order detail</p>
          <p className="font-mono text-sm">{order.order_id}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <ForexDetailGrid
          columns={2}
          items={[
            { label: 'Account', value: order.account_id, mono: true },
            { label: 'Symbol', value: order.symbol },
            { label: 'Side', value: order.side },
            { label: 'Volume', value: order.requested_volume },
            { label: 'Requested price', value: order.requested_price ?? '—' },
            { label: 'Market', value: order.current_price ?? 'NOT AVAILABLE' },
            { label: 'Status', value: order.status },
            { label: 'Venue', value: order.execution_mode },
            { label: 'Age (s)', value: String(order.age_sec) },
            { label: 'Price source', value: order.price_source },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onAction('accept')}>
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAction('reject')}>
            Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAction('assign')}>
            Assign
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAction('escalate')}>
            Escalate
          </Button>
        </div>
        {auditBlock}
      </div>
    </div>
  );
}
