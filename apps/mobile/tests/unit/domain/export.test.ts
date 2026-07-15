import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { escapeCsvCell, ordersToCsv, walletTransactionsToCsv } from '@core/domain/export/csv';
import {
  createExportLog,
  filterOrdersForExport,
  filterWalletTransactions,
  fetchAllHistoryOrdersForExport,
  fetchAllWalletTransactionsForExport,
  normalizeTxExportType,
  toDateBounds,
} from '@core/domain/export/dataExport';

const mockGetTransactionsAll = jest.fn<() => Promise<{ items: unknown[]; total: number }>>();
const mockListOrders = jest.fn<
  () => Promise<{ orders: unknown[]; next_cursor?: string | null }>
>();

jest.mock('@core/repositories/WalletRepository', () => ({
  getWalletRepository: () => ({
    getTransactionsAll: mockGetTransactionsAll,
  }),
}));

jest.mock('@core/repositories/SpotRepository', () => ({
  getSpotRepository: () => ({
    listOrders: mockListOrders,
  }),
}));

describe('export csv', () => {
  it('escapes csv cells with commas and quotes', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('formats order rows like website exportCsv', () => {
    const csv = ordersToCsv([
      {
        created_at: '2026-07-01T00:00:00Z',
        market: 'BTC-USDT',
        side: 'BUY',
        type: 'LIMIT',
        price: '50000',
        stop_price: null,
        quantity: '1',
        filled_quantity: '0.5',
        status: 'PARTIALLY_FILLED',
      },
    ]);
    expect(csv.split('\n')[0]).toBe('Time,Market,Side,Type,Price,Stop Price,Quantity,Filled,Status');
    expect(csv).toContain('BTC-USDT,BUY,LIMIT,50000,,1,0.5,PARTIALLY_FILLED');
  });

  it('formats wallet transactions like website data-export page', () => {
    const csv = walletTransactionsToCsv([
      {
        created_at: '2026-07-01T12:00:00Z',
        type: 'deposit',
        symbol: 'BTC',
        amount: '0.1',
        status: 'completed',
        txid: 'abc',
      },
    ]);
    expect(csv.split('\n')[0]).toBe('Time,Type,Asset,Amount,Status,Tx Hash');
    expect(csv).toContain('2026-07-01T12:00:00Z,deposit,BTC,0.1,completed,abc');
  });
});

describe('export filters', () => {
  it('builds preset date bounds', () => {
    const { start, end } = toDateBounds('7days', '', '');
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    const spanDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(spanDays).toBeGreaterThanOrEqual(6.9);
    expect(spanDays).toBeLessThanOrEqual(7.1);
  });

  it('normalizes withdraw alias for withdrawal filter', () => {
    expect(normalizeTxExportType('withdraw')).toBe('withdrawal');
    expect(normalizeTxExportType('DEPOSIT')).toBe('deposit');
  });

  it('filters wallet transactions by date and type', () => {
    const start = new Date('2026-07-01T00:00:00');
    const end = new Date('2026-07-31T23:59:59');
    const rows = [
      { created_at: '2026-07-10T00:00:00Z', type: 'withdraw', symbol: 'BTC', amount: '1', status: 'completed' },
      { created_at: '2026-06-01T00:00:00Z', type: 'deposit', symbol: 'ETH', amount: '2', status: 'completed' },
    ];
    const filtered = filterWalletTransactions(rows, start, end, 'withdrawal');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.type).toBe('withdraw');
  });

  it('filters orders by date range', () => {
    const start = new Date('2026-07-01T00:00:00');
    const end = new Date('2026-07-31T23:59:59');
    const orders = [
      {
        created_at: '2026-07-05T00:00:00Z',
        market: 'BTC-USDT',
        side: 'BUY',
        price: '1',
        quantity: '1',
        filled_quantity: '1',
        status: 'FILLED',
      },
      {
        created_at: '2026-05-01T00:00:00Z',
        market: 'ETH-USDT',
        side: 'SELL',
        price: '1',
        quantity: '1',
        filled_quantity: '1',
        status: 'FILLED',
      },
    ];
    expect(filterOrdersForExport(orders, start, end, 'all')).toHaveLength(1);
  });

  it('creates session export log entries', () => {
    const log = createExportLog({ kind: 'transaction', status: 'completed', rows: 3, fileName: 'a.csv' });
    expect(log.id).toBeTruthy();
    expect(log.requestedAt).toBeTruthy();
    expect(log.rows).toBe(3);
  });
});

describe('export pagination', () => {
  beforeEach(() => {
    mockGetTransactionsAll.mockReset();
    mockListOrders.mockReset();
  });

  it('paginates wallet transactions until total exhausted', async () => {
    mockGetTransactionsAll
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, i) => ({
          type: 'deposit',
          symbol: 'BTC',
          amount: String(i),
          status: 'completed',
          created_at: '2026-07-01T00:00:00Z',
        })),
        total: 150,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => ({
          type: 'deposit',
          symbol: 'ETH',
          amount: String(i),
          status: 'completed',
          created_at: '2026-07-02T00:00:00Z',
        })),
        total: 150,
      });

    const rows = await fetchAllWalletTransactionsForExport();
    expect(rows).toHaveLength(150);
    expect(mockGetTransactionsAll).toHaveBeenCalledTimes(2);
  });

  it('paginates spot history orders via cursor until exhausted', async () => {
    mockListOrders
      .mockResolvedValueOnce({
        orders: [
          {
            market: 'BTC-USDT',
            side: 'BUY',
            type: 'LIMIT',
            price: '1',
            stop_price: null,
            quantity: '1',
            filled_quantity: '1',
            status: 'FILLED',
            created_at: '2026-07-01T00:00:00Z',
          },
        ],
        next_cursor: 'c1',
      })
      .mockResolvedValueOnce({
        orders: [
          {
            market: 'ETH-USDT',
            side: 'SELL',
            type: 'LIMIT',
            price: '2',
            stop_price: null,
            quantity: '1',
            filled_quantity: '1',
            status: 'FILLED',
            created_at: '2026-07-02T00:00:00Z',
          },
        ],
        next_cursor: null,
      });

    const orders = await fetchAllHistoryOrdersForExport();
    expect(orders).toHaveLength(2);
    expect(mockListOrders).toHaveBeenCalledTimes(2);
  });
});
