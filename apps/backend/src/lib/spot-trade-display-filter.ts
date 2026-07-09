/** Filter public trade tape rows that are far from the live reference price (QA / E2E fills). */

export function filterTradesNearReferencePrice<T extends { price: string }>(
  rows: T[],
  referencePrice: string | null | undefined,
  maxDeviationPct = 0.2
): T[] {
  const ref = referencePrice != null && referencePrice !== '' ? Number(referencePrice) : NaN;
  if (!Number.isFinite(ref) || ref <= 0) return rows;
  return rows.filter((row) => {
    const p = Number(row.price);
    if (!Number.isFinite(p) || p <= 0) return false;
    return Math.abs(p - ref) / ref <= maxDeviationPct;
  });
}
