'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Loader2, X, RefreshCw, Trash2, Download } from 'lucide-react';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { ordersToCsv, tradesToCsv, downloadCsv } from '@/lib/exportCsv';
import { useSpotBottomPanel, type Order } from './useSpotBottomPanel';
import { useBalancesByAccount } from '@/lib/balances';
import { ROUTES, SPOT_TRADE_HREF, walletPath } from '@/lib/routes';
import { useMemo, useState, useEffect, useRef } from 'react';
import { formatFixedTrim, formatValueFixedTrim } from './terminalFormat';
import { TerminalEmptyState, TerminalLoadingRows } from './TerminalEmptyState';

/** Per-symbol decimals from exchange metadata (tier-1 formatting). */
export type SpotMarketMeta = {
  symbol: string;
  price_precision?: number;
  qty_precision?: number;
};

interface SpotBottomPanelProps {
  symbol: string;
  isAuth: boolean;
  ordersVersion?: number;
  tradesVersion?: number;
  markets?: SpotMarketMeta[];
  promptCancelAllConfirmation?: boolean;
}

function precisionForMarket(markets: SpotMarketMeta[] | undefined, marketSymbol: string | null | undefined) {
  const clamp = (n: number | undefined, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(12, Math.max(0, Math.floor(n))) : fallback;
  if (!markets?.length || !marketSymbol) return { price: 8, qty: 8 };
  const m = markets.find((x) => x.symbol === marketSymbol);
  return {
    price: clamp(m?.price_precision, 8),
    qty: clamp(m?.qty_precision, 8),
  };
}

function formatOrderPrice(value: string | null | undefined, decimals: number): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return formatValueFixedTrim(value, decimals);
}

function displayStatusLocalized(s: string, tc: (key: string) => string): string {
  if (s === 'OPEN' || s === 'NEW') return tc('orders.status.open');
  if (s === 'PENDING_TRIGGER') return tc('orders.status.pendingTrigger');
  if (s === 'PARTIALLY_FILLED') return tc('orders.status.partiallyFilled');
  if (s === 'REJECTED') return tc('orders.status.rejected');
  if (s === 'CANCELLED') return tc('orders.status.cancelled');
  if (s === 'FILLED') return tc('orders.status.filled');
  return s || tc('orders.status.unknown');
}

function executionStatusPill(status: string, tc: (key: string) => string) {
  const u = (status || '').toUpperCase();
  const base =
    'inline-flex items-center rounded-full px-2 py-0.5 text-label font-bold uppercase tracking-wide transition-colors duration-300';
  if (u === 'OPEN' || u === 'NEW') {
    return (
      <span
        className={`${base} bg-buy/15 text-buy`}
        title={tc('bottomPanel.statusTitle.workingOrder')}
      >
        {tc('orders.status.open')}
      </span>
    );
  }
  if (u === 'PARTIALLY_FILLED') {
    return (
      <span
        className={`${base} bg-primary/12 text-foreground`}
        title={tc('bottomPanel.statusTitle.partiallyFilled')}
      >
        {tc('orders.status.partiallyFilled')}
      </span>
    );
  }
  if (u === 'FILLED') {
    return (
      <span className={`${base} bg-buy/15 text-buy`} title={tc('bottomPanel.statusTitle.filled')}>
        {tc('orders.status.filled')}
      </span>
    );
  }
  if (u === 'PENDING_TRIGGER') {
    return <span className={`${base} bg-muted/60 text-muted-foreground`}>{tc('orders.status.pendingTrigger')}</span>;
  }
  if (u === 'CANCELLED' || u === 'REJECTED') {
    return (
      <span className={`${base} bg-muted/60 text-muted-foreground`}>{displayStatusLocalized(status, tc)}</span>
    );
  }
  return <span className={`${base} bg-muted/50 text-muted-foreground`}>{displayStatusLocalized(status, tc)}</span>;
}

function OpenOrderRow({
  o,
  onCancel,
  cancellingId,
  priceDecimals,
  qtyDecimals,
}: {
  o: Order;
  onCancel: (id: string) => void;
  cancellingId: string | null | undefined;
  priceDecimals: number;
  qtyDecimals: number;
}) {
  const tc = useTranslations('crypto');
  const [pulse, setPulse] = useState(false);
  const prev = useRef({ status: o.status, filled: o.filled_quantity });
  useEffect(() => {
    if (prev.current.status !== o.status || prev.current.filled !== o.filled_quantity) {
      setPulse(true);
      prev.current = { status: o.status, filled: o.filled_quantity };
      const t = window.setTimeout(() => setPulse(false), 700);
      return () => window.clearTimeout(t);
    }
  }, [o.status, o.filled_quantity]);

  const canCancel = ['OPEN', 'PARTIALLY_FILLED', 'PENDING_TRIGGER'].includes(o.status);
  const filled = parseFloat(o.filled_quantity ?? '0') || 0;
  const qty = parseFloat(o.quantity ?? '0') || 0;
  const filledQtyStr =
    filled > 0 && qty > 0
      ? `${formatFixedTrim(filled, qtyDecimals)}/${formatFixedTrim(qty, qtyDecimals)}`
      : (o.quantity ?? '—');
  return (
    <tr
      className={`min-h-8 border-b border-border/80 transition-[background-color,box-shadow] duration-500 ease-out hover:bg-muted/50 ${
        pulse ? 'bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]' : ''
      }`}
    >
      <td className="py-1 px-2 align-middle">
        <div className="flex items-center gap-1">
          <CoinIcon symbol={o.market?.split('_')[0] || ''} size={14} />
          <span className="numeric text-label text-foreground">{o.market}</span>
        </div>
      </td>
      <td className="py-1 px-2 align-middle">
        <span className="text-label text-muted-foreground">{displayOrderType(o.type, tc)}</span>
      </td>
      <td className="py-1 px-2 align-middle">
        <span className={o.side === 'buy' ? 'text-buy' : 'text-sell'}>{displaySide(o.side, tc)}</span>
      </td>
      <td className="numeric py-1.5 px-2 align-middle text-label text-muted-foreground">
        {formatOrderPrice(o.price ?? null, priceDecimals)}
      </td>
      <td className="numeric py-1.5 px-2 align-middle text-label text-muted-foreground">
        {formatOrderPrice(o.stop_price ?? null, priceDecimals)}
      </td>
      <td className="numeric py-1.5 px-2 align-middle text-label text-muted-foreground">{filledQtyStr}</td>
      <td className="py-1 px-2 align-middle">{executionStatusPill(o.status, tc)}</td>
      <td className="py-1 px-2 align-middle">
        {canCancel && (
          <button
            type="button"
            disabled={!!cancellingId}
            onClick={() => onCancel(o.id)}
            className="min-h-[32px] touch-manipulation rounded px-2 py-1 text-label text-destructive hover:underline disabled:opacity-50"
          >
            {cancellingId === o.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : tc('bottomPanel.cancel')}
          </button>
        )}
      </td>
    </tr>
  );
}

function displayOrderType(type: string | undefined, tc: (key: string) => string): string {
  if (!type) return '—';
  const map: Record<string, string> = {
    limit: tc('trading.limit'),
    market: tc('trading.market'),
    stop_loss: tc('trading.stop'),
    stop_limit: tc('trading.stopLimit'),
    trailing_stop_market: tc('trading.trailing'),
    oco: tc('orderTypes.bracket'),
  };
  return map[type] ?? type;
}

function displaySide(side: string, tc: (key: string) => string): string {
  if (side === 'buy') return tc('trading.buy');
  if (side === 'sell') return tc('trading.sell');
  return side;
}

export function SpotBottomPanel(props: SpotBottomPanelProps) {
  const tc = useTranslations('crypto');
  const {
    symbol,
    isAuth,
    ordersVersion = 0,
    tradesVersion = 0,
    markets,
    promptCancelAllConfirmation = true,
  } = props;
  const data = useSpotBottomPanel({
    symbol,
    isAuth,
    ordersVersion,
    tradesVersion,
    promptCancelAllConfirmation,
  });
  const { data: balancesByAccount = [] } = useBalancesByAccount(isAuth);
  const allTradingBalances = useMemo(
    () => balancesByAccount.filter((b) => parseFloat(b.trading ?? '0') > 0).slice(0, 24),
    [balancesByAccount]
  );
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const tradingBalances = useMemo(() => {
    if (!hideSmallBalances) return allTradingBalances;
    const min = 0.0001;
    return allTradingBalances.filter((b) => parseFloat(b.trading ?? '0') >= min);
  }, [allTradingBalances, hideSmallBalances]);
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const compare = (av: unknown, bv: unknown, key: string, dir: number) => {
    if (key.endsWith('_at')) {
      const at = av ? new Date(String(av)).getTime() : 0;
      const bt = bv ? new Date(String(bv)).getTime() : 0;
      return (at - bt) * dir;
    }
    if (key === 'price' || key === 'quantity' || key === 'filled_quantity' || key === 'fee') {
      return (Number(av ?? 0) - Number(bv ?? 0)) * dir;
    }
    return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
  };

  const displayOpenOrders = useMemo(() => {
    const list = showAllMarkets ? data.openOrders : (data.openOrdersForMarket ?? data.openOrders.filter((o) => o.market === symbol));
    return list;
  }, [data.openOrders, data.openOrdersForMarket, symbol, showAllMarkets]);

  const getField = (obj: Record<string, unknown>, key: string): unknown => obj[key as keyof typeof obj];

  const sortedOpenOrders = useMemo(() => {
    const list = [...displayOpenOrders];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => compare(getField(a, sortKey), getField(b, sortKey), sortKey, dir));
    return list;
  }, [displayOpenOrders, sortKey, sortDir]);

  const displayOrderHistory = useMemo(() => {
    if (showAllMarkets) return data.orderHistory;
    return data.orderHistory.filter((o) => !symbol || o.market === symbol);
  }, [data.orderHistory, symbol, showAllMarkets]);

  const sortedOrderHistory = useMemo(() => {
    const list = [...displayOrderHistory];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => compare(getField(a, sortKey), getField(b, sortKey), sortKey, dir));
    return list;
  }, [displayOrderHistory, sortKey, sortDir]);

  const displayTrades = useMemo(() => {
    if (showAllMarkets) return data.trades;
    return data.trades.filter((t) => !symbol || t.market === symbol);
  }, [data.trades, symbol, showAllMarkets]);

  const sortedTrades = useMemo(() => {
    const list = [...displayTrades];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => compare(getField(a, sortKey), getField(b, sortKey), sortKey, dir));
    return list;
  }, [displayTrades, sortKey, sortDir]);

  const sortGlyph = (key: string) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  if (!isAuth) {
    return (
      <div className="flex min-h-[320px] w-full flex-col bg-card">
        <div className="flex min-h-10 items-center gap-1 border-b border-border bg-muted/35 px-2">
          {(
            [
              tc('bottomPanel.openOrders'),
              tc('bottomPanel.orderHistory'),
              tc('bottomPanel.tradeHistory'),
              tc('bottomPanel.assets'),
              tc('bottomPanel.positions'),
            ] as const
          ).map((label) => (
            <span
              key={label}
              className="inline-flex min-h-[36px] items-center rounded border border-border/70 bg-muted/40 px-2.5 terminal-text-label font-semibold uppercase tracking-[0.04em] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="grid flex-1 gap-2 p-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/80 bg-muted/25 p-3">
              <div className="mb-2 h-3 w-24 rounded bg-muted" />
              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded bg-muted/80" />
                <div className="h-2.5 w-[85%] rounded bg-muted/70" />
                <div className="h-2.5 w-[70%] rounded bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-4 py-3 text-center text-[12px] text-muted-foreground">
          {tc('empty.signInForOrders')}
        </div>
      </div>
    );
  }

  const openOrdersForMarket = symbol ? data.openOrders.filter((o) => o.market === symbol) : [];
  const canCancelAll = symbol && openOrdersForMarket.length > 0 && !data.cancellingAll;

  const tabBtn = (active: boolean) =>
    `min-h-9 flex touch-manipulation items-center border-b-2 px-2 py-1 terminal-text-secondary font-semibold leading-none transition-colors duration-150 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:px-3 ${
      active
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div id="spot-terminal-activity" className="flex h-[min(50vh,560px)] min-h-[320px] w-full flex-col bg-card">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-1 border-b border-border bg-muted/40 px-1">
        <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
          <button type="button" onClick={() => data.setTab('open')} className={tabBtn(data.tab === 'open')}>{tc('bottomPanel.tabs.open')} ({data.openOrders.length})</button>
          <button type="button" onClick={() => data.setTab('orders')} className={tabBtn(data.tab === 'orders')}>{tc('bottomPanel.tabs.history')}</button>
          <button type="button" onClick={() => data.setTab('trades')} className={tabBtn(data.tab === 'trades')}>{tc('bottomPanel.tabs.trades')}</button>
          <button type="button" onClick={() => data.setTab('assets')} className={tabBtn(data.tab === 'assets')}>{tc('bottomPanel.tabs.assets')}</button>
          <button type="button" onClick={() => data.setTab('positions')} className={tabBtn(data.tab === 'positions')}>{tc('bottomPanel.tabs.positions')}</button>
        </div>
        <div className="flex items-center gap-2 pr-2">
          {(data.tab === 'open' || data.tab === 'orders' || data.tab === 'trades') && (
            <button type="button" onClick={() => setShowAllMarkets((v) => !v)} className="min-h-8 touch-manipulation rounded border border-border px-2 py-1 text-label leading-none text-muted-foreground hover:text-foreground" title={showAllMarkets ? tc('bottomPanel.showPairOnlyTitle') : tc('bottomPanel.showAllMarketsTitle')}>
              {showAllMarkets ? tc('bottomPanel.filterAllMarkets') : tc('bottomPanel.filterPairOnly')}
            </button>
          )}
          {data.tab === 'open' && canCancelAll && (
            <button type="button" onClick={() => data.handleCancelAll?.()} disabled={data.cancellingAll} className="flex min-h-8 touch-manipulation items-center gap-1 rounded border border-destructive/30 px-2 py-1 text-label leading-none text-destructive hover:bg-destructive/10 disabled:opacity-50" title={tc('bottomPanel.cancelAllTitle')}>
              {data.cancellingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {data.cancelAllArmed ? tc('bottomPanel.confirmAll') : tc('bottomPanel.cancelAllButton')}
            </button>
          )}
          {data.tab === 'orders' && data.orderHistory.length > 0 && (
            <button type="button" onClick={() => { const csv = ordersToCsv(data.orderHistory); downloadCsv(`spot-orders-${new Date().toISOString().slice(0,10)}.csv`, csv); }} className="flex min-h-8 touch-manipulation items-center gap-1 rounded border border-border px-2 py-1 text-label leading-none text-muted-foreground hover:text-foreground" title={tc('bottomPanel.exportOrderHistoryCsv')}>
              <Download className="w-3 h-3" /> {tc('bottomPanel.export')}
            </button>
          )}
          {data.tab === 'trades' && data.trades.length > 0 && (
            <button type="button" onClick={() => { const csv = tradesToCsv(data.trades); downloadCsv(`spot-trades-${new Date().toISOString().slice(0,10)}.csv`, csv); }} className="flex min-h-8 touch-manipulation items-center gap-1 rounded border border-border px-2 py-1 text-label leading-none text-muted-foreground hover:text-foreground" title={tc('bottomPanel.exportTradesCsvTitle')}>
              <Download className="w-3 h-3" /> {tc('bottomPanel.export')}
            </button>
          )}
          <button type="button" onClick={() => { data.tab === 'open' && data.fetchOpen?.(); data.tab === 'orders' && data.fetchOrderHistory?.(null, false); data.tab === 'trades' && data.fetchTrades?.(1, false); }} className="flex min-h-8 min-w-8 touch-manipulation items-center justify-center rounded text-muted-foreground hover:text-foreground" title={tc('bottomPanel.refresh')}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {data.cancelError && (
        <div className="px-3 py-1.5 flex items-center justify-between bg-destructive/10 text-destructive text-xs">
          <span>{data.cancelError}</span>
          <button type="button" onClick={() => data.setCancelError(null)} aria-label={tc('bottomPanel.dismiss')}><X className="w-3 h-3" /></button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        {data.tab === 'open' && (
          data.openLoading ? (
            <TerminalLoadingRows rows={6} />
          ) : data.openOrders.length === 0 ? (
            <TerminalEmptyState kind="orders" title={tc('empty.noOpenOrders')} description={tc('bottomPanel.openOrdersDesc')} compact />
          ) : (
            <table className="w-full table-fixed text-label">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border text-left font-medium text-muted-foreground">
                  <th className="py-1 px-2 font-medium cursor-pointer w-24" onClick={() => toggleSort('market')}>{tc('bottomPanel.columns.market')}{sortGlyph('market')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-16" onClick={() => toggleSort('type')}>{tc('bottomPanel.columns.type')}{sortGlyph('type')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-12" onClick={() => toggleSort('side')}>{tc('bottomPanel.columns.side')}{sortGlyph('side')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-20" onClick={() => toggleSort('price')}>{tc('bottomPanel.columns.price')}{sortGlyph('price')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-20" onClick={() => toggleSort('stop_price')}>{tc('bottomPanel.columns.trigger')}{sortGlyph('stop_price')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-24" onClick={() => toggleSort('quantity')}>{tc('bottomPanel.columns.filledQty')}{sortGlyph('quantity')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer" onClick={() => toggleSort('status')}>{tc('bottomPanel.columns.status')}{sortGlyph('status')}</th>
                  <th className="py-1 px-2 font-medium w-16">{tc('bottomPanel.columns.action')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedOpenOrders.map((o) => {
                  const pq = precisionForMarket(markets, o.market);
                  return (
                    <OpenOrderRow
                      key={o.id}
                      o={o}
                      onCancel={(id) => data.handleCancel(id)}
                      cancellingId={data.cancellingId}
                      priceDecimals={pq.price}
                      qtyDecimals={pq.qty}
                    />
                  );
                })}
              </tbody>
            </table>
          )
        )}
        {data.tab === 'orders' && (
          data.orderHistoryLoading ? (
            <TerminalLoadingRows rows={6} />
          ) : data.orderHistory.length === 0 ? (
            <TerminalEmptyState kind="orders" title={tc('bottomPanel.noOrderHistory')} description={tc('bottomPanel.noOrderHistoryDesc')} compact />
          ) : (
            <table className="w-full table-fixed text-label">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1 px-2 font-medium cursor-pointer w-24" onClick={() => toggleSort('market')}>{tc('bottomPanel.columns.market')}{sortGlyph('market')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-16" onClick={() => toggleSort('type')}>{tc('bottomPanel.columns.type')}{sortGlyph('type')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-12" onClick={() => toggleSort('side')}>{tc('bottomPanel.columns.side')}{sortGlyph('side')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-20" onClick={() => toggleSort('price')}>{tc('bottomPanel.columns.price')}{sortGlyph('price')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-20" onClick={() => toggleSort('stop_price')}>{tc('bottomPanel.columns.trigger')}{sortGlyph('stop_price')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer w-24" onClick={() => toggleSort('quantity')}>{tc('bottomPanel.columns.filledQty')}{sortGlyph('quantity')}</th>
                  <th className="py-1 px-2 font-medium cursor-pointer" onClick={() => toggleSort('status')}>{tc('bottomPanel.columns.status')}{sortGlyph('status')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrderHistory.map((o) => {
                  const filled = parseFloat(o.filled_quantity ?? '0') || 0;
                  const qty = parseFloat(o.quantity ?? '0') || 0;
                  const pq = precisionForMarket(markets, o.market);
                  const filledQtyStr =
                    filled > 0 || o.status === 'FILLED'
                      ? `${formatFixedTrim(filled, pq.qty)}/${formatFixedTrim(qty, pq.qty)}`
                      : (o.quantity ?? '—');
                  return (
                    <tr key={o.id} className="min-h-8 border-b border-border/80 transition-colors duration-150 hover:bg-muted/50">
                      <td className="py-1 px-2 align-middle">
                        <div className="flex items-center gap-1">
                          <CoinIcon symbol={o.market?.split('_')[0] || ''} size={14} />
                          <span className="numeric text-foreground">{o.market}</span>
                        </div>
                      </td>
                      <td className="py-1 px-2 align-middle text-muted-foreground">{displayOrderType(o.type, tc)}</td>
                      <td className="py-1 px-2 align-middle">
                        <span className={o.side === 'buy' ? 'text-buy' : 'text-sell'}>{displaySide(o.side, tc)}</span>
                      </td>
                      <td className="numeric py-1 px-2 align-middle text-muted-foreground">
                        {formatOrderPrice(o.price ?? null, pq.price)}
                      </td>
                      <td className="numeric py-1 px-2 align-middle text-muted-foreground">
                        {formatOrderPrice(o.stop_price ?? null, pq.price)}
                      </td>
                      <td className="numeric py-1 px-2 align-middle text-muted-foreground">{filledQtyStr}</td>
                      <td className="py-1 px-2 align-middle">{executionStatusPill(o.status, tc)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
        {data.tab === 'assets' && (
          <div className="p-2">
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-label text-muted-foreground">
              <input
                type="checkbox"
                checked={hideSmallBalances}
                onChange={(e) => setHideSmallBalances(e.target.checked)}
                className="rounded border-border"
              />
              {tc('bottomPanel.hideSmallBalances')}
            </label>
            {tradingBalances.length === 0 ? (
              <TerminalEmptyState kind="generic" title={tc('bottomPanel.noTradingBalance')} description={tc('bottomPanel.noTradingBalanceDesc')} compact />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {tradingBalances.map((b) => (
                  <Link key={b.symbol} href={`/wallet/${b.symbol}`} className="flex items-center justify-between rounded px-2 py-1.5 text-label hover:bg-muted">
                    <div className="flex items-center gap-1.5">
                      <CoinIcon symbol={b.symbol} size={16} />
                      <span className="text-foreground">{b.symbol}</span>
                    </div>
                    <span className="numeric text-muted-foreground">
                      {formatValueFixedTrim(b.trading ?? '0', 8)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <Link href={walletPath.overview} className="mt-2 block text-center text-label font-medium text-primary hover:underline dark:text-primary">
              {tc('bottomPanel.viewAllAssets')}
            </Link>
          </div>
        )}
        {data.tab === 'positions' && (
          <div className="p-3">
            <div className="mb-2 rounded-md border border-border/70 bg-muted/25 px-3 py-2 text-[12px] text-muted-foreground">
              {tc('bottomPanel.spotPositionsNote')}
            </div>
            {tradingBalances.length === 0 ? (
              <TerminalEmptyState kind="generic" title={tc('empty.noPositions')} description={tc('empty.noPositionsDesc')} compact />
            ) : (
              <table className="w-full table-fixed text-label">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1 px-2 font-medium">{tc('bottomPanel.columns.asset')}</th>
                    <th className="py-1 px-2 text-right font-medium">{tc('bottomPanel.columns.tradingBalance')}</th>
                    <th className="py-1 px-2 text-right font-medium">{tc('bottomPanel.columns.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tradingBalances.map((b) => (
                    <tr key={b.symbol} className="border-b border-border/80 hover:bg-muted/40">
                      <td className="py-1 px-2">
                        <div className="flex items-center gap-1.5">
                          <CoinIcon symbol={b.symbol} size={14} />
                          <span className="font-medium text-foreground">{b.symbol}</span>
                        </div>
                      </td>
                      <td className="numeric py-1 px-2 text-right text-foreground">
                        {formatValueFixedTrim(b.trading ?? '0', 8)}
                      </td>
                      <td className="py-1 px-2 text-right text-muted-foreground">
                        {parseFloat(b.trading ?? '0') > 0 ? tc('bottomPanel.positionStatusActive') : tc('bottomPanel.positionStatusIdle')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {data.tab === 'trades' && (
          data.tradesLoading ? (
            <TerminalLoadingRows rows={6} />
          ) : data.trades.length === 0 ? (
            <div className="flex flex-col items-center px-3 py-4">
              <TerminalEmptyState
                kind="trades"
                title={tc('bottomPanel.noRecentTrades')}
                description={tc('bottomPanel.noRecentTradesDesc')}
                compact
              />
              <Link
                href={SPOT_TRADE_HREF}
                className="mt-2 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 terminal-text-label font-semibold text-primary-foreground transition-opacity duration-150 hover:opacity-90"
              >
                {tc('bottomPanel.openSpot')}
              </Link>
            </div>
          ) : (
            <>
              <table className="w-full table-fixed text-label">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-1 px-2 font-medium cursor-pointer w-24" onClick={() => toggleSort('market')}>{tc('bottomPanel.columns.market')}{sortGlyph('market')}</th>
                    <th className="py-1 px-2 font-medium cursor-pointer w-12" onClick={() => toggleSort('side')}>{tc('bottomPanel.columns.side')}{sortGlyph('side')}</th>
                    <th className="py-1 px-2 font-medium cursor-pointer w-20" onClick={() => toggleSort('price')}>{tc('bottomPanel.columns.price')}{sortGlyph('price')}</th>
                    <th className="py-1 px-2 font-medium cursor-pointer w-20" onClick={() => toggleSort('quantity')}>{tc('terminal.qty')}{sortGlyph('quantity')}</th>
                    <th className="py-1 px-2 font-medium cursor-pointer w-16" onClick={() => toggleSort('fee')}>{tc('bottomPanel.columns.fee')}{sortGlyph('fee')}</th>
                    <th className="py-1 px-2 font-medium cursor-pointer" onClick={() => toggleSort('created_at')}>{tc('bottomPanel.columns.time')}{sortGlyph('created_at')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTrades.map((t) => {
                    const pq = precisionForMarket(markets, t.market);
                    const feeNum = t.fee != null && t.fee !== '' ? Number(t.fee) : NaN;
                    const feeDisplay =
                      t.fee != null && t.fee !== ''
                        ? `${Number.isFinite(feeNum) ? formatValueFixedTrim(t.fee, 8) : t.fee}${t.fee_asset ? ` ${t.fee_asset}` : ''}`
                        : '—';
                    return (
                    <tr key={t.id} className="min-h-8 border-b border-border/80 transition-colors duration-150 hover:bg-muted/50">
                      <td className="py-1 px-2 align-middle">
                        <div className="flex items-center gap-1">
                          <CoinIcon symbol={t.market?.split('_')[0] || ''} size={14} />
                          <span className="numeric text-foreground">{t.market}</span>
                        </div>
                      </td>
                      <td className="py-1 px-2 align-middle">
                        <span className={t.side === 'buy' ? 'text-buy' : 'text-sell'}>{displaySide(t.side, tc)}</span>
                      </td>
                      <td className="numeric py-1 px-2 align-middle text-muted-foreground">
                        {formatValueFixedTrim(t.price, pq.price)}
                      </td>
                      <td className="numeric py-1 px-2 align-middle text-muted-foreground">
                        {formatValueFixedTrim(t.quantity, pq.qty)}
                      </td>
                      <td className="numeric py-1 px-2 align-middle text-muted-foreground">{feeDisplay}</td>
                      <td className="numeric py-1 px-2 align-middle text-muted-foreground">
                        {t.created_at ? new Date(t.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.tradesPage < data.tradesTotalPages && (
                <div className="p-2 border-t border-border">
                  <button
                    type="button"
                    disabled={!!data.tradesLoadMore}
                    onClick={data.loadMoreTrades}
                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {data.tradesLoadMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {tc('bottomPanel.loadMore')}
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
