/** Shared OHLC relation check. Does not invent prices. */

function decCmp(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return 0;
  return na === nb ? 0 : na > nb ? 1 : -1;
}

export function isValidOhlcRelation(c: { open: string; high: string; low: string; close: string }): boolean {
  const maxOc = decCmp(c.open, c.close) >= 0 ? c.open : c.close;
  const minOc = decCmp(c.open, c.close) <= 0 ? c.open : c.close;
  return decCmp(c.high, maxOc) >= 0 && decCmp(c.low, minOc) <= 0;
}
