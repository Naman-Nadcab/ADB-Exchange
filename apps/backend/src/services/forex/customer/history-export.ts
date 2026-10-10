/**
 * Account-scoped CSV exports for customer history (authenticated caller only).
 */
import { publicForexOrder } from '../orders/models.js';
import { getForexOrderService } from '../orders/service.js';
import { getForexAccountingService } from '../accounting/service.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cols: unknown[]): string {
  return cols.map(csvEscape).join(',');
}

function accounting() {
  const pricing = getForexPricingService();
  const positions = getForexPositionService(pricing);
  return getForexAccountingService(positions, pricing);
}

export function exportCustomerOrdersCsv(accountId: string): string {
  const orders = getForexOrderService()
    .listOwned(accountId)
    .map(publicForexOrder);
  const header = row([
    'order_id',
    'client_order_id',
    'symbol',
    'side',
    'type',
    'volume',
    'requested_price',
    'limit_price',
    'time_in_force',
    'status',
    'stop_loss',
    'take_profit',
    'created_at',
    'updated_at',
  ]);
  const lines = orders.map((o) =>
    row([
      o.orderId,
      o.clientOrderId,
      o.symbol,
      o.side,
      o.type,
      o.requestedVolume,
      o.requestedPrice,
      o.limitPrice,
      o.timeInForce,
      o.status,
      o.stopLoss,
      o.takeProfit,
      o.createdAt,
      o.updatedAt,
    ])
  );
  return [header, ...lines].join('\n');
}

export function exportCustomerFillsCsv(accountId: string): string {
  const fills = getForexOrderService().listFills(accountId);
  const header = row(['fill_id', 'order_id', 'symbol', 'side', 'volume', 'price', 'timestamp']);
  const lines = fills.map((f) =>
    row([f.fillId, f.orderId, f.symbol, f.side, f.volume, f.price, f.timestamp])
  );
  return [header, ...lines].join('\n');
}

export function exportCustomerClosedTradesCsv(accountId: string): string {
  const view = accounting().publicLedgerView(accountId);
  const header = row([
    'transaction_id',
    'time',
    'symbol',
    'side',
    'volume',
    'open_price',
    'close_price',
    'profit',
    'position_id',
    'fill_id',
    'currency',
  ]);
  const lines = view.transactions
    .filter((t) => t.type === 'REALIZED_PNL')
    .map((t) => {
      const ref = t.reference ?? {};
      const pnl = ref.pnl && typeof ref.pnl === 'object' ? (ref.pnl as Record<string, unknown>) : {};
      return row([
        t.transactionId,
        t.timestamp,
        ref.symbol ?? pnl.symbol ?? '',
        pnl.side ?? '',
        pnl.closedVolume ?? '',
        pnl.entryPrice ?? '',
        pnl.closePrice ?? '',
        pnl.accountPnl ?? t.net,
        ref.positionId ?? '',
        ref.fillId ?? '',
        t.currency,
      ]);
    });
  return [header, ...lines].join('\n');
}

export function exportCustomerLedgerCsv(accountId: string): string {
  const view = accounting().publicLedgerView(accountId);
  const header = row(['transaction_id', 'type', 'net', 'currency', 'balance_after', 'reference', 'timestamp', 'status']);
  const lines = view.transactions.map((t) =>
    row([t.transactionId, t.type, t.net, t.currency, t.balanceAfter, t.reference, t.timestamp, t.status])
  );
  return [header, ...lines].join('\n');
}
