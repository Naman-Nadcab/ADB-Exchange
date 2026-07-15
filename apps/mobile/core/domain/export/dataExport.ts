import { getSpotRepository } from '@core/repositories/SpotRepository';
import { getWalletRepository } from '@core/repositories/WalletRepository';
import type { SpotOrder } from '@exchange/mobile-types';
import type { ExportOrderRow, WalletTxExportRow } from './csv';

export type DataExportTab = 'transaction' | 'order' | 'account';
export type TimeRangeType = '7days' | '30days' | '90days' | 'custom';
export type TransactionExportType = 'all' | 'deposit' | 'withdrawal' | 'transfer';
export type OrderExportType = 'all' | 'trade';

export type ExportLog = {
  id: string;
  kind: DataExportTab;
  requestedAt: string;
  status: 'completed' | 'failed';
  rows: number;
  fileName?: string;
  reason?: string;
};

const TX_PAGE_SIZE = 100;
const ORDER_PAGE_SIZE = 100;
const MAX_ORDER_PAGES = 1000;

export function toDateBounds(
  timeRange: TimeRangeType,
  startDate: string,
  endDate: string,
): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);
  if (timeRange === '7days') start.setDate(end.getDate() - 7);
  if (timeRange === '30days') start.setDate(end.getDate() - 30);
  if (timeRange === '90days') start.setDate(end.getDate() - 90);
  if (timeRange === 'custom') {
    const s = new Date(`${startDate}T00:00:00`);
    const e = new Date(`${endDate}T23:59:59`);
    return { start: Number.isFinite(s.getTime()) ? s : start, end: Number.isFinite(e.getTime()) ? e : end };
  }
  return { start, end };
}

export function normalizeTxExportType(type: string): string {
  const t = type.toLowerCase();
  if (t === 'withdraw') return 'withdrawal';
  return t;
}

export function filterWalletTransactions(
  rows: WalletTxExportRow[],
  start: Date,
  end: Date,
  exportType: TransactionExportType,
): WalletTxExportRow[] {
  return rows.filter((t) => {
    const stamp = t.date_time ?? t.created_at;
    const ms = stamp ? new Date(stamp).getTime() : NaN;
    if (!Number.isFinite(ms)) return false;
    if (ms < start.getTime() || ms > end.getTime()) return false;
    if (exportType !== 'all') {
      const rowType = normalizeTxExportType(t.type ?? '');
      if (rowType !== exportType) return false;
    }
    return true;
  });
}

export function filterOrdersForExport(
  orders: ExportOrderRow[],
  start: Date,
  end: Date,
  exportType: OrderExportType,
): ExportOrderRow[] {
  return orders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    if (!Number.isFinite(t)) return false;
    if (t < start.getTime() || t > end.getTime()) return false;
    if (exportType !== 'all' && exportType !== 'trade') return false;
    return true;
  });
}

export function spotOrderToExportRow(order: SpotOrder): ExportOrderRow {
  return {
    market: order.market,
    side: order.side,
    type: order.type,
    price: order.price ?? null,
    stop_price: order.stop_price ?? null,
    quantity: order.quantity,
    filled_quantity: order.filled_quantity,
    status: order.status,
    created_at: order.created_at,
  };
}

export function walletTxToExportRow(row: {
  type: string;
  symbol: string;
  amount: string;
  status: string;
  created_at: string;
  txid?: string;
}): WalletTxExportRow {
  const exportType = row.type === 'withdrawal' ? 'withdraw' : row.type;
  return {
    created_at: row.created_at,
    date_time: row.created_at,
    type: exportType,
    coin: row.symbol,
    symbol: row.symbol,
    quantity: row.amount,
    amount: row.amount,
    status: row.status,
    txid: row.txid,
  };
}

/** Exhaustively paginate wallet transactions until backend total is reached. */
export async function fetchAllWalletTransactionsForExport(): Promise<WalletTxExportRow[]> {
  const repo = getWalletRepository();
  const all: WalletTxExportRow[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const page = await repo.getTransactionsAll({ limit: TX_PAGE_SIZE, offset });
    if (page.items.length === 0) break;
    all.push(
      ...page.items.map((item) =>
        walletTxToExportRow({
          type: item.type,
          symbol: item.symbol,
          amount: item.amount,
          status: item.status,
          created_at: item.created_at,
          txid: item.txid,
        }),
      ),
    );
    total = page.total;
    offset += TX_PAGE_SIZE;
  }

  return all;
}

/** Exhaustively paginate spot history orders via cursor until exhausted. */
export async function fetchAllHistoryOrdersForExport(): Promise<ExportOrderRow[]> {
  const repo = getSpotRepository();
  const orders: ExportOrderRow[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_ORDER_PAGES; page += 1) {
    const res = await repo.listOrders({ status: 'HISTORY', limit: ORDER_PAGE_SIZE, cursor });
    const batch = res.orders ?? [];
    if (batch.length === 0) break;
    orders.push(...batch.map(spotOrderToExportRow));
    cursor = res.next_cursor ?? undefined;
    if (!cursor) break;
  }

  return orders;
}

export function createExportLog(entry: Omit<ExportLog, 'id' | 'requestedAt'>): ExportLog {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    requestedAt: new Date().toISOString(),
    ...entry,
  };
}
