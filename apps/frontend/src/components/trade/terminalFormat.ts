export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function formatFixedTrim(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '—';
  const d = clampInt(decimals, 0, 12);
  const s = n.toFixed(d);
  return s.replace(/\.?0+$/, '');
}

export function formatValueFixedTrim(
  value: string | number | null | undefined,
  decimals: number
): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  return formatFixedTrim(n, decimals);
}

/**
 * Digits for chart axis and header prices.
 * Instrument `price_precision` stays the order tick. This only stops a
 * high-priced print such as 85250.32 from painting as 85250.32000000.
 */
export function visualPriceDecimals(instrumentPrecision: number, sample?: number | string | null): number {
  const cap = clampInt(Number.isFinite(instrumentPrecision) ? instrumentPrecision : 2, 0, 8);
  const n = typeof sample === 'number' ? sample : sample == null || sample === '' ? NaN : Number(sample);
  if (!Number.isFinite(n) || n === 0) return Math.min(cap, 2);
  const abs = Math.abs(n);
  const floor = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  const ceil = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  const frac = (abs.toFixed(cap).split('.')[1] ?? '').replace(/0+$/, '').length;
  return Math.min(cap, Math.max(floor, Math.min(ceil, frac)));
}

export function formatCompactNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

