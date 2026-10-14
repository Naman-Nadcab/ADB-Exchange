/**
 * Drop candle prints that cannot belong to the live crypto series.
 * A stale internal fill (for example a test trade at 100) would otherwise
 * flatten a chart whose live price is the Chainlink/oracle price.
 */
export function median(values: number[]): number | null {
  const sane = values.filter((n) => Number.isFinite(n) && n > 0);
  if (!sane.length) return null;
  const sorted = [...sane].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function anchorFromNewestCloses(closes: number[], tail = 30): number | null {
  if (!closes.length) return null;
  return median(closes.slice(-tail));
}

export function filterCandlesNearAnchor<T extends { close: string }>(
  rows: T[],
  anchor: number | null,
  maxDeviation = 0.35
): T[] {
  if (anchor == null || !Number.isFinite(anchor) || anchor <= 0 || rows.length === 0) return rows;
  const kept = rows.filter((row) => {
    const close = Number(row.close);
    if (!Number.isFinite(close) || close <= 0) return false;
    return Math.abs(close - anchor) / anchor <= maxDeviation;
  });
  return kept.length > 0 ? kept : rows;
}
