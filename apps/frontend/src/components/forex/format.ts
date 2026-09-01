export function fxNum(value: string | number | null | undefined, digits = 5): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fxPlain(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}
