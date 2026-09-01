export function fxNum(value: string | number | null | undefined, digits = 5): string {
  if (value == null || value === '') return 'Unavailable';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fxMoney(value: string | number | null | undefined, currency = 'USD'): string {
  if (value == null || value === '') return 'Unavailable';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fxSigned(value: string | number | null | undefined, digits = 2): { text: string; tone: 'pos' | 'neg' | 'flat' | 'na' } {
  if (value == null || value === '') return { text: 'Unavailable', tone: 'na' };
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return { text: String(value), tone: 'na' };
  const text = n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: 'exceptZero' });
  return { text, tone: n > 0 ? 'pos' : n < 0 ? 'neg' : 'flat' };
}

export function fxPlain(value: string | number | null | undefined): string {
  if (value == null || value === '') return 'Unavailable';
  return String(value);
}
