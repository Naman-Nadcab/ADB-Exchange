/** CSV formatting mirrored from apps/frontend/src/lib/exportCsv.ts and data-export page. */

export function escapeCsvCell(val: unknown): string {
  if (val == null || val === '') return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export type ExportOrderRow = {
  market: string;
  side: string;
  type?: string;
  price: string | null;
  stop_price?: string | null;
  quantity: string;
  filled_quantity: string;
  status: string;
  created_at: string;
};

export function ordersToCsv(orders: ExportOrderRow[]): string {
  const headers = ['Time', 'Market', 'Side', 'Type', 'Price', 'Stop Price', 'Quantity', 'Filled', 'Status'];
  const rows = orders.map((o) => [
    o.created_at,
    o.market,
    o.side,
    o.type ?? '',
    o.price ?? '',
    o.stop_price ?? '',
    o.quantity,
    o.filled_quantity,
    o.status,
  ]);
  return [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\n');
}

export type WalletTxExportRow = {
  date_time?: string;
  created_at?: string;
  type?: string;
  coin?: string;
  symbol?: string;
  quantity?: string;
  amount?: string;
  status?: string;
  txid?: string;
  txHash?: string;
};

export function walletTransactionsToCsv(rows: WalletTxExportRow[]): string {
  const headers = ['Time', 'Type', 'Asset', 'Amount', 'Status', 'Tx Hash'];
  const body = rows.map((r) => [
    r.date_time ?? r.created_at ?? '',
    r.type ?? '',
    r.coin ?? r.symbol ?? '',
    r.quantity ?? r.amount ?? '',
    r.status ?? '',
    r.txid ?? r.txHash ?? '',
  ]);
  return [headers.map(escapeCsvCell).join(','), ...body.map((row) => row.map(escapeCsvCell).join(','))].join('\n');
}
