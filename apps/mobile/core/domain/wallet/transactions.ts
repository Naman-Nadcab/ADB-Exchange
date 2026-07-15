import type { WalletRecentTransaction } from '@exchange/mobile-types';

/** Backend `/wallet/transactions/all` uses coin, quantity, date_time, type "withdraw". */
export function normalizeWalletTx(row: Record<string, unknown>): WalletRecentTransaction {
  const typeRaw = String(row.type || '');
  const type: WalletRecentTransaction['type'] =
    typeRaw === 'withdraw' || typeRaw === 'withdrawal'
      ? 'withdrawal'
      : typeRaw === 'deposit'
        ? 'deposit'
        : 'transfer';
  const qty = row.quantity ?? row.amount ?? '0';
  return {
    id: String(row.id ?? ''),
    type,
    symbol: String(row.coin ?? row.symbol ?? ''),
    amount: typeof qty === 'number' ? String(qty) : String(qty),
    status: String(row.status ?? ''),
    created_at: String(row.date_time ?? row.created_at ?? ''),
    chain_type: row.chain_type != null ? String(row.chain_type) : undefined,
  };
}

export function formatTxAmount(amount: string): string {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n === 0) return '0.00';
  const abs = Math.abs(n);
  if (abs < 0.01) return n.toFixed(6);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export function formatTxDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
