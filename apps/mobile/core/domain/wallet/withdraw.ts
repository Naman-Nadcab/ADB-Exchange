/** Client-side validation only — financial values always from backend preview API. */

export function validateCryptoAddress(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return 'Address is required';
  if (trimmed.length < 10) return 'Address looks too short';
  if (trimmed.length > 256) return 'Address is too long';
  return null;
}

export function validateMemo(memo: string, required: boolean): string | null {
  const trimmed = memo.trim();
  if (required && !trimmed) return 'Memo/tag is required for this network';
  if (trimmed.length > 128) return 'Memo is too long';
  return null;
}

export function validateWithdrawAmount(
  amount: string,
  available: string,
  minWithdrawal: string,
): string | null {
  const a = parseFloat(amount);
  const avail = parseFloat(available);
  const min = parseFloat(minWithdrawal);
  if (!Number.isFinite(a) || a <= 0) return 'Enter a valid amount';
  if (Number.isFinite(min) && a < min) return `Minimum withdrawal is ${minWithdrawal}`;
  if (!Number.isFinite(avail) || a > avail) return 'Insufficient balance';
  return null;
}

export function formatNetworkLabel(chainName: string, confirmations?: number): string {
  const conf = confirmations != null ? ` · ${confirmations} confirmations` : '';
  return `${chainName}${conf}`;
}

export function computeMaxWithdrawAmount(available: string, fee: string): string {
  const avail = parseFloat(available);
  const f = parseFloat(fee);
  if (!Number.isFinite(avail) || avail <= 0) return '0';
  const max = Math.max(0, avail - (Number.isFinite(f) ? f : 0));
  return String(max);
}

export function applyWithdrawPercent(available: string, fee: string, pct: number): string {
  const max = parseFloat(computeMaxWithdrawAmount(available, fee));
  if (!Number.isFinite(max) || max <= 0) return '0';
  const amt = (max * pct) / 100;
  return amt.toFixed(8).replace(/\.?0+$/, '') || '0';
}

export function withdrawalStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'pending_email_verify') return 'Pending email verification';
  if (s === 'pending_2fa') return 'Pending 2FA';
  if (s === 'pending_approval') return 'Pending approval';
  if (s === 'pending_blockchain') return 'Processing on-chain';
  if (s === 'processing') return 'Processing';
  if (s === 'completed') return 'Completed';
  if (s === 'failed') return 'Failed';
  if (s === 'cancelled') return 'Cancelled';
  return status;
}

export function buildWithdrawExplorerUrl(txHash: string, chain?: string): string | null {
  if (!txHash) return null;
  const c = (chain ?? '').toLowerCase();
  if (c.includes('btc') || c.includes('bitcoin')) return `https://mempool.space/tx/${txHash}`;
  if (c.includes('sol')) return `https://solscan.io/tx/${txHash}`;
  if (c.includes('bsc') || c.includes('bnb')) return `https://bscscan.com/tx/${txHash}`;
  if (c.includes('polygon') || c.includes('matic')) return `https://polygonscan.com/tx/${txHash}`;
  if (c.includes('avax')) return `https://snowtrace.io/tx/${txHash}`;
  if (c.includes('arb')) return `https://arbiscan.io/tx/${txHash}`;
  if (c.includes('tron') || c.includes('trx')) return `https://tronscan.org/#/transaction/${txHash}`;
  return `https://etherscan.io/tx/${txHash}`;
}
