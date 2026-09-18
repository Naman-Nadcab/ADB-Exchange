'use client';

import { useEffect, useState } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ForexConfirmModal(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  dangerous?: boolean;
  minReasonLength?: number;
  reasonRequired?: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const {
    open,
    onClose,
    title,
    description,
    confirmLabel = 'Confirm',
    dangerous,
    minReasonLength = 8,
    reasonRequired = true,
    loading,
    onConfirm,
  } = props;
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const reasonOk = !reasonRequired || reason.trim().length >= minReasonLength;

  const submit = async () => {
    if (!reasonOk) {
      setError(`Audit reason must be at least ${minReasonLength} characters.`);
      return;
    }
    setError(null);
    await onConfirm(reason.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="md">
      {reasonRequired ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-admin-muted">Audit reason</label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ops ticket or incident reference"
            className="h-9"
            autoFocus
          />
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
        </div>
      ) : null}
      <ModalFooter className="-mx-6 mt-4 border-t border-admin-border px-6">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={dangerous ? 'danger' : 'primary'}
          size="sm"
          disabled={loading || (reasonRequired && !reasonOk)}
          onClick={() => void submit()}
        >
          {loading ? 'Working…' : confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
