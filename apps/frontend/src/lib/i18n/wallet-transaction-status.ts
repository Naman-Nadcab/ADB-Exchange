type WalletT = (key: string) => string;

const STATUS_KEYS: Record<string, string> = {
  pending: 'transactions.pending',
  processing: 'transactions.processing',
  completed: 'transactions.completed',
  failed: 'transactions.failed',
  rejected: 'transactions.rejected',
  cancelled: 'transactions.cancelled',
  pending_approval: 'transactions.pendingApproval',
  queued: 'transactions.queued',
  signed: 'transactions.signed',
  broadcasted: 'transactions.broadcasted',
  confirmed: 'transactions.confirmed',
};

/** Presentation-only label for wallet withdrawal/activity status enums. */
export function walletTransactionStatusLabel(status: string, t: WalletT): string {
  const s = (status || '').toLowerCase();
  const key = STATUS_KEYS[s];
  if (key) return t(key);
  if (!status) return '—';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}
