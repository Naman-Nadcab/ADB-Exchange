/** Market Watch style pair label. Six-letter symbols become AAA/BBB. */
export function formatForexPair(symbol: string | null | undefined): string {
  const raw = String(symbol ?? '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if (raw.length === 6) return `${raw.slice(0, 3)}/${raw.slice(3)}`;
  return raw || String(symbol ?? '').trim();
}
