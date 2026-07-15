import type { ConvertCurrency, ConvertBalance } from '@exchange/mobile-types';
import type { ConvertQuote } from '@exchange/mobile-types';

export function formatQuoteCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function buildQuoteSnapshot(quote: ConvertQuote): {
  toAmount: string;
  rate: string;
  fee: string;
  expiresAtMs: number;
  fromCurrencyId: string;
  toCurrencyId: string;
} | null {
  const toAmount = quote.to?.amount ?? '';
  const rate = quote.rate ?? '';
  const fromId = quote.from?.id ?? '';
  const toId = quote.to?.id ?? '';
  if (!toAmount || !rate || !fromId || !toId) return null;
  const sec = typeof quote.expiresIn === 'number' ? quote.expiresIn : 30;
  return {
    toAmount,
    rate,
    fee: quote.fee ?? '0',
    expiresAtMs: Date.now() + sec * 1000,
    fromCurrencyId: fromId,
    toCurrencyId: toId,
  };
}

export function computeSlippagePercent(fromAmount: string, rate: string, toAmount: string): string {
  const from = parseFloat(fromAmount);
  const r = parseFloat(rate);
  const to = parseFloat(toAmount);
  if (!Number.isFinite(from) || !Number.isFinite(r) || !Number.isFinite(to) || from * r === 0) return '< 0.5%';
  const expected = from * r;
  const impact = Math.abs((expected - to) / expected) * 100;
  return impact < 0.5 ? '< 0.5%' : `~${impact.toFixed(2)}%`;
}

export function formatRateDisplay(fromSymbol: string, toSymbol: string, rate: string): string {
  const r = parseFloat(rate);
  const formatted = Number.isFinite(r)
    ? r.toLocaleString(undefined, { maximumSignificantDigits: 8 })
    : rate;
  return `1 ${fromSymbol} ≈ ${formatted} ${toSymbol}`;
}

export function validateConvertPair(fromSymbol: string, toSymbol: string): string | null {
  if (!fromSymbol || !toSymbol) return 'Select both assets.';
  if (fromSymbol === toSymbol) return 'Choose two different assets.';
  return null;
}

export function validateConvertAmount(amount: string, available: string): string | null {
  const a = parseFloat(amount);
  const avail = parseFloat(available);
  if (!Number.isFinite(a) || a <= 0) return 'Enter a valid amount.';
  if (!Number.isFinite(avail) || a > avail) return 'Amount exceeds available balance.';
  return null;
}

export function applyConvertPercent(available: string, pct: number): string {
  const avail = parseFloat(available);
  if (!Number.isFinite(avail) || avail <= 0) return '0';
  const amt = (avail * pct) / 100;
  return amt.toFixed(8).replace(/\.?0+$/, '') || '0';
}

export function computeRemainingAfterConvert(available: string, amount: string): string {
  const avail = parseFloat(available);
  const a = parseFloat(amount);
  if (!Number.isFinite(avail)) return '0';
  if (!Number.isFinite(a) || a <= 0) return String(avail);
  const rem = Math.max(0, avail - a);
  return rem.toFixed(8).replace(/\.?0+$/, '') || '0';
}

export function filterConvertCurrencies(
  currencies: ConvertCurrency[],
  opts: { search?: string; hideZero?: boolean; favorites?: Set<string>; balances?: ConvertBalance[] },
): ConvertCurrency[] {
  const balanceMap = new Map((opts.balances ?? []).map((b) => [b.symbol.toUpperCase(), b]));
  let list = [...currencies];
  if (opts.hideZero && opts.balances) {
    list = list.filter((c) => parseFloat(balanceMap.get(c.symbol.toUpperCase())?.available_balance ?? '0') > 0);
  }
  if (opts.search?.trim()) {
    const s = opts.search.trim().toLowerCase();
    list = list.filter((c) => c.symbol.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
  }
  if (opts.favorites?.size) {
    list.sort((a, b) => {
      const af = opts.favorites!.has(a.symbol);
      const bf = opts.favorites!.has(b.symbol);
      if (af && !bf) return -1;
      if (!af && bf) return 1;
      return a.symbol.localeCompare(b.symbol);
    });
  }
  return list;
}

export function convertStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed') return 'Completed';
  if (s === 'pending') return 'Pending';
  if (s === 'processing') return 'Processing';
  if (s === 'failed') return 'Failed';
  if (s === 'cancelled') return 'Cancelled';
  return status;
}

export function mapConvertApiError(code: string | undefined, message: string): string {
  switch (code) {
    case 'INSUFFICIENT_BALANCE':
      return 'Insufficient balance';
    case 'INVALID_AMOUNT':
      return 'Enter a valid amount';
    case 'INVALID_TOKEN':
    case 'INVALID_CURRENCIES':
      return 'Selected pair is unavailable';
    case 'DUPLICATE_REQUEST':
    case 'IDEMPOTENCY_KEY_REUSED':
      return 'Duplicate request — check conversion history';
    case 'IDEMPOTENCY_KEY_IN_PROGRESS':
      return 'Conversion in progress — wait and check history';
    case 'PRICE_STALE':
      return 'Conversion price is temporarily stale; get a new quote';
    case 'UNAUTHORIZED':
      return 'Session expired. Please sign in again.';
    default:
      if (message.toLowerCase().includes('rate not available')) return 'Conversion rate not available for this pair';
      if (message.toLowerCase().includes('expired')) return 'Quote expired. Get a new quote to continue.';
      return message || 'Conversion failed. Please try again.';
  }
}
