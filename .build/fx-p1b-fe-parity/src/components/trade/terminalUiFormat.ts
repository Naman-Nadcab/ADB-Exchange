/** Presentation-only formatters for terminal UI (no data logic). */

export function formatMoverChangePct(change: number | null | undefined): string {
  if (change == null || !Number.isFinite(change)) return '—';
  if (Math.abs(change) >= 99.995) return 'N/A';
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}

export function moverChangeTone(change: number | null | undefined): 'buy' | 'sell' | 'muted' {
  if (change == null || !Number.isFinite(change)) return 'muted';
  if (Math.abs(change) >= 99.995) return 'muted';
  return change >= 0 ? 'buy' : 'sell';
}
