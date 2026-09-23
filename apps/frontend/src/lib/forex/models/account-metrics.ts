/**
 * Account-strip metrics. Definitions stay financially conservative.
 * Equity = Balance + Unrealized. Free = Equity - Used. Level = Equity/Used×100 or —.
 */
import { formatMarginLevel } from './live-valuation';

function n(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

export interface ForexAccountMetrics {
  currency: string;
  balance: string | null;
  equity: string | null;
  usedMargin: string | null;
  freeMargin: string | null;
  marginLevel: string;
  floating: string | null;
  realized: string | null;
  commission: string;
  swap: string;
  net: string | null;
}

export function composeAccountMetrics(args: {
  currency?: string;
  balance?: string | null;
  equity?: string | null;
  usedMargin?: string | null;
  freeMargin?: string | null;
  floating?: string | null;
  realized?: string | null;
  commission?: string | null;
  swap?: string | null;
}): ForexAccountMetrics {
  const currency = args.currency ?? 'USD';
  const balance = args.balance ?? null;
  const floating = args.floating ?? null;
  const realized = args.realized ?? null;
  const commission = args.commission != null && args.commission !== '' ? args.commission : '0';
  const swap = args.swap != null && args.swap !== '' ? args.swap : '0';
  const used = args.usedMargin ?? null;
  let equity = args.equity ?? null;
  if (equity == null && n(balance) != null && n(floating) != null) {
    equity = (n(balance)! + n(floating)!).toFixed(2);
  }
  let free = args.freeMargin ?? null;
  if (free == null && n(equity) != null && n(used) != null) {
    free = (n(equity)! - n(used)!).toFixed(2);
  }
  const netParts = [n(realized), n(floating), n(commission), n(swap)];
  const net =
    netParts.every((x) => x != null)
      ? ((n(realized) ?? 0) + (n(floating) ?? 0) + (n(commission) ?? 0) + (n(swap) ?? 0)).toFixed(2)
      : null;
  return {
    currency,
    balance,
    equity,
    usedMargin: used,
    freeMargin: free,
    marginLevel: formatMarginLevel(equity, used),
    floating,
    realized,
    commission,
    swap,
    net,
  };
}
