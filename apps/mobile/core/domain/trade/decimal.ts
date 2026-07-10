/** String decimal helpers — never use float for crypto amounts. */

export function parseDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const s = String(value).trim();
  if (!s || s === 'NaN') return '0';
  return s;
}

export function compareDecimal(a: string, b: string): number {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return 0;
  return na - nb;
}

export function roundDown(value: string, precision: number): string {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return '0';
  const factor = Math.pow(10, precision);
  return (Math.floor(n * factor) / factor).toFixed(precision);
}

export function multiplyDecimal(a: string, b: string): string {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return '0';
  return String(na * nb);
}

export function isPositive(value: string): boolean {
  return compareDecimal(value, '0') > 0;
}
