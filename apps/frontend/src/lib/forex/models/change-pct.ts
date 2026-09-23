/**
 * Market Watch Change %.
 *
 * The Forex quote feed carries no day-open, previous-close or 24h statistics,
 * so the only reference the backend can serve is the external OHLC session
 * open from /candles (see market-data/candles.service.ts). When that provider
 * is off or empty there is no reference and Change % stays n/a — it is never
 * synthesized from the simulated mid walk.
 */
import type { ForexQuoteDto } from './types';

export interface ForexChangeReference {
  symbol: string;
  /** Session open of the most recent reference bar. */
  open: string;
  /** Bar timestamp as served by the provider. */
  timestamp: string;
  timeframe: string;
  /** 'EXTERNAL' for provider OHLC, 'SIMULATED' for the empty in-house store. */
  source: string;
}

export type ForexChangeView =
  | {
      status: 'READY';
      changePct: number;
      text: string;
      title: string;
      direction: 'up' | 'down' | 'flat';
    }
  | { status: 'NO_REFERENCE'; text: 'n/a'; title: string; direction: 'flat' };

const NUMERIC = /^-?\d+(\.\d+)?$/;

export function computeChangePct(mid: string | undefined, reference: string | undefined): number | null {
  if (!mid || !reference || !NUMERIC.test(mid) || !NUMERIC.test(reference)) return null;
  const m = Number(mid);
  const r = Number(reference);
  if (!Number.isFinite(m) || !Number.isFinite(r) || r === 0) return null;
  return ((m - r) / r) * 100;
}

function decimals(value: string): number {
  return value.split('.')[1]?.length ?? 0;
}

/** Prefers the published mid; falls back to the bid/ask midpoint. */
export function quoteMid(quote: ForexQuoteDto | undefined): string | undefined {
  if (!quote) return undefined;
  if (quote.mid && NUMERIC.test(quote.mid)) return quote.mid;
  const bid = quote.bid ?? '';
  const ask = quote.ask ?? '';
  if (!NUMERIC.test(bid) || !NUMERIC.test(ask)) return undefined;
  // One extra digit keeps a half-tick midpoint exact without float noise.
  const scale = Math.max(decimals(bid), decimals(ask)) + 1;
  return ((Number(bid) + Number(ask)) / 2).toFixed(scale);
}

export function formatChangePct(changePct: number): string {
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

export function describeForexChange(args: {
  quote: ForexQuoteDto | undefined;
  reference: ForexChangeReference | null | undefined;
  referenceStatus?: 'loading' | 'unavailable' | 'ready';
}): ForexChangeView {
  const mid = quoteMid(args.quote);
  const ref = args.reference;
  if (!ref) {
    const why =
      args.referenceStatus === 'loading'
        ? 'Loading reference session open…'
        : 'Change % unavailable: the Forex quote feed publishes no session open, and no reference OHLC is available for this symbol.';
    return { status: 'NO_REFERENCE', text: 'n/a', title: why, direction: 'flat' };
  }
  const changePct = computeChangePct(mid, ref.open);
  if (changePct == null) {
    return {
      status: 'NO_REFERENCE',
      text: 'n/a',
      title: `Change % unavailable: no usable mid for this symbol (reference ${ref.timeframe} open ${ref.open}).`,
      direction: 'flat',
    };
  }
  const day = ref.timestamp ? new Date(ref.timestamp).toISOString().slice(0, 10) : 'unknown date';
  return {
    status: 'READY',
    changePct,
    text: formatChangePct(changePct),
    title: `${formatChangePct(changePct)} vs ${ref.timeframe} session open ${ref.open} (${ref.source} reference, ${day}). Mid is SIMULATED.`,
    direction: changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat',
  };
}
