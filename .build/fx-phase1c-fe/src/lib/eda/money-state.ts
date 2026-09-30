/** Financial display states. Never treat loading or failure as zero. */

export type EdaMoneyState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; reason?: string }
  | { kind: 'value'; raw: string; formatted: string };

export function formatUsdAmount(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moneyFromBackend(args: {
  loading: boolean;
  failed: boolean;
  value: string | number | null | undefined;
  reason?: string;
}): EdaMoneyState {
  if (args.loading) return { kind: 'loading' };
  if (args.failed) return { kind: 'unavailable', reason: args.reason };
  const formatted = formatUsdAmount(args.value);
  if (formatted == null) return { kind: 'unavailable', reason: args.reason ?? 'UNAVAILABLE' };
  return { kind: 'value', raw: String(args.value), formatted };
}

export function moneyLabel(state: EdaMoneyState, currency = 'USD'): string {
  if (state.kind === 'loading') return 'Loading';
  if (state.kind === 'unavailable') return 'Unavailable';
  if (currency === 'USD') return `$${state.formatted}`;
  return `${state.formatted} ${currency}`;
}
