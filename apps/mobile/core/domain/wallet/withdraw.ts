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
