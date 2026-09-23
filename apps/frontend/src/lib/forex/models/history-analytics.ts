/**
 * Performance and period P&L from actual ledger / fill history.
 * Does not invent equity curves. Drawdown uses ledger running cash only.
 */
import type { ForexFillRow, ForexLedgerRow } from './types';

export type HistoryPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';

export interface ClosedTradeStat {
  ticket: string;
  symbol: string;
  fillId?: string;
  positionId?: string;
  side?: string;
  volume?: string;
  openPrice?: string;
  closePrice?: string;
  gross: number;
  commission: number;
  swap: number;
  net: number;
  timestamp: string;
}

export interface PerformanceStats {
  trades: number;
  winning: number;
  losing: number;
  winRate: string | null;
  grossProfit: string;
  grossLoss: string;
  netProfit: string;
  commission: string;
  swap: string;
  averageWin: string | null;
  averageLoss: string | null;
  largestWin: string | null;
  largestLoss: string | null;
  profitFactor: string | null;
  expectedPayoff: string | null;
}

export interface DrawdownStats {
  source: 'LEDGER_CASH';
  peak: string | null;
  currentDrawdown: string | null;
  maxDrawdown: string | null;
  maxDrawdownPct: string | null;
  note: string;
}

function num(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return n.toFixed(2);
}

export function periodBounds(period: HistoryPeriod, now = new Date(), custom?: { from?: string; to?: string }): { from: number; to: number } {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setTime(start.getTime());
    end.setHours(23, 59, 59, 999);
  } else if (period === 'week') {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
  } else if (period === 'month') {
    start.setDate(1);
  } else if (period === 'custom') {
    const from = custom?.from ? Date.parse(custom.from) : 0;
    const to = custom?.to ? Date.parse(custom.to) : Date.now();
    return { from: Number.isFinite(from) ? from : 0, to: Number.isFinite(to) ? to : Date.now() };
  } else if (period === 'all') {
    return { from: 0, to: Number.MAX_SAFE_INTEGER };
  }
  return { from: start.getTime(), to: end.getTime() };
}

export function inPeriod(ts: string, bounds: { from: number; to: number }): boolean {
  const t = Date.parse(ts);
  return Number.isFinite(t) && t >= bounds.from && t <= bounds.to;
}

function refStr(row: ForexLedgerRow, key: string): string | undefined {
  const ref = row.reference;
  if (!ref || typeof ref !== 'object') return undefined;
  const v = (ref as Record<string, unknown>)[key];
  return v == null ? undefined : String(v);
}

export function closedTradesFromLedger(ledger: ForexLedgerRow[], bounds?: { from: number; to: number }): ClosedTradeStat[] {
  const rows = ledger.filter((r) => String(r.type).toUpperCase() === 'REALIZED_PNL');
  return rows
    .filter((r) => !bounds || inPeriod(r.timestamp, bounds))
    .map((r) => {
      const pnlMeta = r.reference && typeof r.reference === 'object' ? (r.reference as Record<string, unknown>).pnl : undefined;
      const meta = pnlMeta && typeof pnlMeta === 'object' ? (pnlMeta as Record<string, unknown>) : {};
      const gross = num((meta.accountPnl as string) ?? r.net ?? Number(r.credit ?? 0) - Number(r.debit ?? 0));
      return {
        ticket: r.transactionId,
        symbol: refStr(r, 'symbol') ?? String(meta.symbol ?? ''),
        fillId: refStr(r, 'fillId'),
        positionId: refStr(r, 'positionId'),
        side: meta.side != null ? String(meta.side) : undefined,
        volume: meta.closedVolume != null ? String(meta.closedVolume) : undefined,
        openPrice: meta.entryPrice != null ? String(meta.entryPrice) : undefined,
        closePrice: meta.closePrice != null ? String(meta.closePrice) : undefined,
        gross,
        commission: 0,
        swap: 0,
        net: gross,
        timestamp: r.timestamp,
      };
    });
}

export function periodFeeSwap(ledger: ForexLedgerRow[], bounds: { from: number; to: number }): { commission: number; swap: number } {
  let commission = 0;
  let swap = 0;
  for (const r of ledger) {
    if (!inPeriod(r.timestamp, bounds)) continue;
    const t = String(r.type).toUpperCase();
    const net = num(r.net ?? Number(r.credit ?? 0) - Number(r.debit ?? 0));
    if (t === 'FEE') commission += net;
    if (t === 'FUNDING') swap += net;
  }
  return { commission, swap };
}

export function computePerformance(trades: ClosedTradeStat[], extras?: { commission?: number; swap?: number }): PerformanceStats {
  const wins = trades.filter((t) => t.gross > 0);
  const losses = trades.filter((t) => t.gross < 0);
  const grossProfit = wins.reduce((a, t) => a + t.gross, 0);
  const grossLoss = losses.reduce((a, t) => a + t.gross, 0);
  const commission = extras?.commission ?? trades.reduce((a, t) => a + t.commission, 0);
  const swap = extras?.swap ?? trades.reduce((a, t) => a + t.swap, 0);
  const net = trades.reduce((a, t) => a + t.net, 0) + commission + swap;
  const lossAbs = Math.abs(grossLoss);
  return {
    trades: trades.length,
    winning: wins.length,
    losing: losses.length,
    winRate: trades.length === 0 ? null : ((wins.length / trades.length) * 100).toFixed(2),
    grossProfit: money(grossProfit),
    grossLoss: money(grossLoss),
    netProfit: money(net),
    commission: money(commission),
    swap: money(swap),
    averageWin: wins.length ? money(grossProfit / wins.length) : null,
    averageLoss: losses.length ? money(grossLoss / losses.length) : null,
    largestWin: wins.length ? money(Math.max(...wins.map((t) => t.gross))) : null,
    largestLoss: losses.length ? money(Math.min(...losses.map((t) => t.gross))) : null,
    profitFactor: lossAbs === 0 ? null : (grossProfit / lossAbs).toFixed(2),
    expectedPayoff: trades.length === 0 ? null : money(net / trades.length),
  };
}

export function ledgerCashDrawdown(ledger: ForexLedgerRow[]): DrawdownStats {
  const note = 'Cash-balance drawdown from ledger running CUSTOMER_CASH. Floating P&L is not historically persisted.';
  const sorted = [...ledger].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (sorted.length === 0) {
    return { source: 'LEDGER_CASH', peak: null, currentDrawdown: null, maxDrawdown: null, maxDrawdownPct: null, note };
  }
  let peak = Number.NEGATIVE_INFINITY;
  let maxDd = 0;
  let last = 0;
  for (const r of sorted) {
    const bal = num(r.balanceAfter);
    last = bal;
    if (bal > peak) peak = bal;
    const dd = peak - bal;
    if (dd > maxDd) maxDd = dd;
  }
  const current = peak > Number.NEGATIVE_INFINITY ? Math.max(0, peak - last) : 0;
  return {
    source: 'LEDGER_CASH',
    peak: peak > Number.NEGATIVE_INFINITY ? money(peak) : null,
    currentDrawdown: money(current),
    maxDrawdown: money(maxDd),
    maxDrawdownPct: peak > 0 ? ((maxDd / peak) * 100).toFixed(2) : null,
    note,
  };
}

export function fillRowsInPeriod(fills: ForexFillRow[], bounds: { from: number; to: number }): ForexFillRow[] {
  return fills.filter((f) => inPeriod(f.timestamp, bounds));
}
