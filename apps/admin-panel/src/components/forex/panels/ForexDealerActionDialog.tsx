'use client';

import { useEffect, useState } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ForexAdminDealingQueueRow } from '@/lib/admin/forex-api';

export type DealerDialogAction = 'accept' | 'reject' | 'assign' | 'escalate';

export function ForexDealerActionDialog(props: {
  open: boolean;
  action: DealerDialogAction | null;
  order: ForexAdminDealingQueueRow | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payload: { reason: string; assigneeAdminId?: string; escalationAdminId?: string }) => void | Promise<void>;
}) {
  const { open, action, order, loading, onClose, onConfirm } = props;
  const [reason, setReason] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason('');
      setSecondaryId('');
      setError(null);
    }
  }, [open]);

  if (!action || !order) return null;

  const title =
    action === 'accept'
      ? 'Dealer accept (MOCK)'
      : action === 'reject'
        ? 'Dealer reject order'
        : action === 'assign'
          ? 'Assign dealer'
          : 'Escalate order';

  const needsSecondary = action === 'assign' || action === 'escalate';
  const reasonOk = reason.trim().length >= 8;
  const secondaryOk = !needsSecondary || secondaryId.trim().length >= 8;

  const submit = async () => {
    if (!reasonOk) {
      setError('Reason must be at least 8 characters.');
      return;
    }
    if (!secondaryOk) {
      setError('Admin UUID must be at least 8 characters.');
      return;
    }
    setError(null);
    await onConfirm({
      reason: reason.trim(),
      assigneeAdminId: action === 'assign' ? secondaryId.trim() : undefined,
      escalationAdminId: action === 'escalate' ? secondaryId.trim() : undefined,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-3 text-sm">
        <div className="rounded border border-admin-border/60 bg-admin-surface/40 p-3 text-xs">
          <p>
            <span className="text-admin-muted">Order:</span> <span className="font-mono">{order.order_id}</span>
          </p>
          <p>
            <span className="text-admin-muted">Account:</span> {order.account_id} · {order.symbol} {order.side}{' '}
            {order.requested_volume}
          </p>
          <p>
            <span className="text-admin-muted">Status:</span> {order.status} · <span className="text-admin-muted">Age:</span>{' '}
            {order.age_sec}s
          </p>
          <p className="mt-2 text-admin-muted">
            MOCK accept records dealer approval only; reject cancels via FDM. No live LP order is sent.
          </p>
        </div>
        {needsSecondary ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-admin-muted">
              {action === 'assign' ? 'Assignee admin UUID' : 'Escalation admin UUID'}
            </label>
            <Input value={secondaryId} onChange={(e) => setSecondaryId(e.target.value)} className="font-mono text-xs" />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs font-medium text-admin-muted">Audit reason (required)</label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Dealer action reference" />
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
      <ModalFooter className="-mx-6 mt-4 border-t border-admin-border px-6">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={action === 'reject' ? 'danger' : 'primary'}
          size="sm"
          disabled={loading || !reasonOk || !secondaryOk}
          onClick={() => void submit()}
        >
          {loading ? 'Working…' : title}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
