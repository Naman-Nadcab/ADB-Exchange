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

export function validateWithdrawLimits(
  amount: string,
  dailyRemaining?: string,
  monthlyRemaining?: string,
): string | null {
  const a = parseFloat(amount);
  if (!Number.isFinite(a) || a <= 0) return null;
  const daily = dailyRemaining != null ? parseFloat(dailyRemaining) : NaN;
  const monthly = monthlyRemaining != null ? parseFloat(monthlyRemaining) : NaN;
  if (Number.isFinite(daily) && a > daily) return 'Amount exceeds your remaining daily withdrawal limit';
  if (Number.isFinite(monthly) && a > monthly) return 'Amount exceeds your remaining monthly withdrawal limit';
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

export function buildWithdrawExplorerUrl(
  txHash: string,
  chain?: string,
  explorerUrlTemplate?: string,
): string | null {
  if (!txHash) return null;
  if (explorerUrlTemplate) {
    if (explorerUrlTemplate.includes('{tx}')) return explorerUrlTemplate.replace('{tx}', txHash);
    if (explorerUrlTemplate.endsWith('/')) return `${explorerUrlTemplate}${txHash}`;
    return `${explorerUrlTemplate}/tx/${txHash}`;
  }
  const c = (chain ?? '').toLowerCase();
  if (c.includes('btc') || c.includes('bitcoin')) return `https://mempool.space/tx/${txHash}`;
  if (c.includes('sol')) return `https://solscan.io/tx/${txHash}`;
  if (c.includes('bsc') || c.includes('bnb')) return `https://bscscan.com/tx/${txHash}`;
  if (c.includes('polygon') || c.includes('matic')) return `https://polygonscan.com/tx/${txHash}`;
  if (c.includes('avax')) return `https://snowtrace.io/tx/${txHash}`;
  if (c.includes('arb')) return `https://arbiscan.io/tx/${txHash}`;
  if (c.includes('op') || c.includes('optimism')) return `https://optimistic.etherscan.io/tx/${txHash}`;
  if (c.includes('base')) return `https://basescan.org/tx/${txHash}`;
  if (c.includes('tron') || c.includes('trx')) return `https://tronscan.org/#/transaction/${txHash}`;
  return `https://etherscan.io/tx/${txHash}`;
}

/** Maps backend withdrawal error codes to user-facing copy. */
export function mapWithdrawApiError(code: string | undefined, message: string, payload?: unknown): string {
  const body =
    payload && typeof payload === 'object' && 'error' in payload
      ? (payload as { error?: Record<string, unknown> }).error
      : undefined;
  const unlockAt = typeof body?.unlockAt === 'string' ? body.unlockAt : undefined;
  const cooldownUntil = typeof body?.cooldown_until === 'string' ? body.cooldown_until : undefined;

  switch (code) {
    case 'KYC_REQUIRED':
      return 'Complete identity verification (KYC) before withdrawing.';
    case 'WITHDRAWAL_COOLDOWN_ACTIVE':
      return cooldownUntil
        ? `Withdrawals are temporarily disabled until ${new Date(cooldownUntil).toLocaleString()}.`
        : 'Withdrawals are temporarily disabled after a recent security change.';
    case 'WITHDRAWALS_PAUSED':
    case 'WITHDRAWAL_DISABLED':
      return 'Withdrawals are temporarily paused for maintenance. Try again later.';
    case 'ADDRESS_NOT_WHITELISTED':
      return 'This address is not whitelisted. Add it to your address book and wait for the timelock.';
    case 'ADDRESS_TIMELOCKED':
      return unlockAt
        ? `This address is locked until ${new Date(unlockAt).toLocaleString()}.`
        : 'This address is in a timelock period and cannot be used yet.';
    case 'INSUFFICIENT_BALANCE':
      return 'Insufficient balance for this withdrawal.';
    case '2FA_REQUIRED':
    case 'INVALID_2FA':
      return message || 'Two-factor authentication is required or invalid.';
    case 'FUND_PASSWORD_REQUIRED':
    case 'INVALID_FUND_PASSWORD':
      return message || 'Fund password is required or invalid.';
    case 'SANCTIONS_BLOCKED':
    case 'RISK_BLOCKED':
      return message || 'Withdrawal blocked by compliance policy. Contact support.';
    case 'UNAUTHORIZED':
      return 'Session expired. Please sign in again.';
    default:
      return message || 'Withdrawal failed. Please try again.';
  }
}
