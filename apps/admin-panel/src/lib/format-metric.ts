/**
 * Display helpers — never show 0 when data is missing; show NO DATA instead.
 */
export function displayMetric(
  value: number | null | undefined,
  format?: (n: number) => string,
): string {
  if (value == null || !Number.isFinite(value)) return 'NO DATA';
  return format ? format(value) : String(value);
}

export function displayMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'NO DATA';
  return `${Math.round(value)}ms`;
}

export function displayPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'NO DATA';
  return `${Math.round(value * 10) / 10}%`;
}

export function displayCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'NO DATA';
  return String(Math.round(value));
}

export function metricOrNull<T extends number>(value: T | null | undefined, loaded: boolean): number | null {
  if (!loaded) return null;
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}
