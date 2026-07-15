import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import {
  TextField,
  PrimaryButton,
  SegmentControl,
  ErrorBanner,
  TerminalPanel,
  PercentageSlider,
  BalanceCard,
  showToast,
  StatusChip,
} from '@shared/ui';
import { useTheme, hapticMedium } from '@shared/theme';
import { validateOrder } from '@core/domain/trade/orderbook';
import { formatPrice } from '@core/domain/markets/formatPrice';
import { marketRefPrice, normalizeFeeRate } from '@core/domain/trade/spotPriceDisplay';
import type { OrderSide, OrderType, OrderbookSnapshot, PlaceOrderRequest, SpotMarket, TimeInForce } from '@exchange/mobile-types';
import { usePlaceOrder } from '../hooks/useTrade';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import { OrderConfirmSheet } from './OrderConfirmSheet';

const ORDER_TYPES: { id: OrderType; label: string }[] = [
  { id: 'limit', label: 'Limit' },
  { id: 'market', label: 'Market' },
  { id: 'stop_loss', label: 'Stop' },
  { id: 'stop_limit', label: 'Stop Limit' },
  { id: 'trailing_stop_market', label: 'Trailing' },
];

const TIF_OPTIONS: { id: TimeInForce; label: string }[] = [
  { id: 'gtc', label: 'GTC' },
  { id: 'ioc', label: 'IOC' },
  { id: 'fok', label: 'FOK' },
];

type Props = {
  symbol: string;
  market?: SpotMarket;
  quoteBalance: string;
  baseBalance: string;
  quoteAsset: string;
  baseAsset: string;
  lastPrice?: string | null;
  orderbook?: OrderbookSnapshot;
  tradingEnabled: boolean;
  presetPrice?: string;
  presetQuantity?: string;
  privateChannelsReady?: boolean;
};

function newClientOrderId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function floorQty(qty: number, precision: number): string {
  const f = 10 ** precision;
  return String(Math.floor(qty * f) / f);
}

type ColumnProps = {
  side: OrderSide;
  qty: string;
  setQty: (v: string) => void;
  percent: number;
  setPercent: (v: number) => void;
  balance: string;
  asset: string;
  refPrice: number;
  qtyPrecision: number;
  feeRate: number;
  quoteAsset: string;
  baseAsset: string;
  onSubmit: (side: OrderSide, qty: string) => void;
  loading: boolean;
  disabled: boolean;
};

function OrderColumn({
  side,
  qty,
  setQty,
  percent,
  setPercent,
  balance,
  asset,
  refPrice,
  qtyPrecision,
  feeRate,
  quoteAsset,
  baseAsset,
  onSubmit,
  loading,
  disabled,
}: ColumnProps) {
  const { theme } = useTheme();
  const color = side === 'buy' ? theme.colors.tradeBuy : theme.colors.tradeSell;
  const q = parseFloat(qty) || 0;
  const notional = q > 0 && refPrice > 0 ? q * refPrice : 0;
  const feeAmount = notional * feeRate;
  const netReceive =
    side === 'buy' ? q * Math.max(0, 1 - feeRate) : notional - feeAmount;

  const applyPct = (pct: number) => {
    setPercent(pct);
    const avail = parseFloat(balance);
    if (!Number.isFinite(avail)) return;
    if (side === 'buy') {
      if (refPrice <= 0) return;
      setQty(floorQty((avail * pct) / 100 / refPrice, qtyPrecision));
    } else {
      setQty(floorQty((avail * pct) / 100, qtyPrecision));
    }
  };

  return (
    <View style={[styles.column, { borderColor: `hsl(${color} / 0.35)` }]}>
      <Text style={[styles.colTitle, { color: `hsl(${color})` }]}>{side === 'buy' ? 'Buy' : 'Sell'}</Text>
      <BalanceCard label="Available" available={balance} asset={asset} />
      <TextField placeholder={`Amount (${baseAsset})`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
      <PercentageSlider value={percent} onChange={applyPct} />
      {notional > 0 ? (
        <Text style={[styles.estimate, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          {side === 'buy' ? 'Pay' : 'Receive'} ~{formatPrice(notional, quoteAsset)}
          {feeRate > 0 ? ` · Fee ~${formatPrice(feeAmount, quoteAsset)}` : ''}
        </Text>
      ) : null}
      {netReceive > 0 ? (
        <Text style={[styles.net, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Net {side === 'buy' ? baseAsset : quoteAsset}: {formatPrice(netReceive, side === 'buy' ? baseAsset : quoteAsset)}
        </Text>
      ) : null}
      <PrimaryButton
        title={side === 'buy' ? `Buy ${baseAsset}` : `Sell ${baseAsset}`}
        variant={side === 'buy' ? 'buy' : 'sell'}
        loading={loading}
        disabled={disabled}
        onPress={() => onSubmit(side, qty)}
      />
    </View>
  );
}

export function DualOrderEntry({
  symbol,
  market,
  quoteBalance,
  baseBalance,
  quoteAsset,
  baseAsset,
  lastPrice,
  orderbook,
  tradingEnabled,
  presetPrice,
  presetQuantity,
  privateChannelsReady = true,
}: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('gtc');
  const [postOnly, setPostOnly] = useState(false);
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailingDelta, setTrailingDelta] = useState('');
  const [buyQty, setBuyQty] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [buyPct, setBuyPct] = useState(0);
  const [sellPct, setSellPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PlaceOrderRequest | null>(null);
  const place = usePlaceOrder();

  const qtyPrecision = market?.qty_precision ?? 6;
  const isLimitLike = orderType === 'limit' || orderType === 'stop_limit';
  const isMarketLike =
    orderType === 'market' || orderType === 'stop_loss' || orderType === 'trailing_stop_market';
  const showTif = orderType === 'limit' || orderType === 'stop_limit';

  useEffect(() => {
    if (presetPrice) setPrice(presetPrice);
  }, [presetPrice]);
  useEffect(() => {
    if (presetQuantity) {
      setBuyQty(presetQuantity);
      setSellQty(presetQuantity);
    }
  }, [presetQuantity]);
  useEffect(() => {
    if (orderType !== 'limit') setPostOnly(false);
    if (orderType !== 'limit' && orderType !== 'stop_limit') setTimeInForce('gtc');
  }, [orderType]);
  useEffect(() => {
    if (postOnly) setTimeInForce('gtc');
  }, [postOnly]);

  const buyRefPrice = useMemo(() => {
    if (isLimitLike) {
      const input = parseFloat(price);
      if (Number.isFinite(input) && input > 0) return input;
      const live = lastPrice ? parseFloat(lastPrice) : NaN;
      return Number.isFinite(live) ? live : 0;
    }
    return marketRefPrice('buy', orderbook, lastPrice);
  }, [isLimitLike, price, lastPrice, orderbook]);

  const sellRefPrice = useMemo(() => {
    if (isLimitLike) {
      const input = parseFloat(price);
      if (Number.isFinite(input) && input > 0) return input;
      const live = lastPrice ? parseFloat(lastPrice) : NaN;
      return Number.isFinite(live) ? live : 0;
    }
    return marketRefPrice('sell', orderbook, lastPrice);
  }, [isLimitLike, price, lastPrice, orderbook]);

  const makerFeeRate = normalizeFeeRate(market?.maker_fee);
  const takerFeeRate = normalizeFeeRate(market?.taker_fee);
  const buyFeeRate = orderType === 'limit' && postOnly ? makerFeeRate : takerFeeRate;
  const sellFeeRate = buyFeeRate;

  const buildOrder = useCallback(
    (side: OrderSide, quantity: string): PlaceOrderRequest | null => {
      if (!market) return null;
      const req: PlaceOrderRequest = {
        market: symbol,
        side,
        type: orderType,
        quantity,
        client_order_id: newClientOrderId(),
        price: isLimitLike ? price || undefined : undefined,
        stop_price: orderType === 'stop_loss' || orderType === 'stop_limit' ? stopPrice : undefined,
        trailing_delta: orderType === 'trailing_stop_market' ? trailingDelta : undefined,
        time_in_force: showTif ? timeInForce : isMarketLike || orderType === 'trailing_stop_market' ? 'ioc' : undefined,
        post_only: orderType === 'limit' && postOnly ? true : undefined,
      };
      const v = validateOrder(req, market);
      if (!v.valid) {
        setError(v.message);
        return null;
      }
      return req;
    },
    [market, symbol, orderType, price, stopPrice, trailingDelta, showTif, timeInForce, isLimitLike, isMarketLike, postOnly],
  );

  const requestSubmit = (side: OrderSide, quantity: string) => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot place orders');
      return;
    }
    if (!tradingEnabled) {
      setError('Market not live — orders disabled');
      return;
    }
    if (!privateChannelsReady) {
      setError('Account syncing — try again shortly');
      return;
    }
    const req = buildOrder(side, quantity);
    if (!req) return;
    setPendingOrder(req);
    setConfirmVisible(true);
  };

  const submit = async () => {
    if (!pendingOrder) return;
    try {
      await place.mutateAsync(pendingOrder);
      void hapticMedium();
      showToast(`${pendingOrder.side === 'buy' ? 'Buy' : 'Sell'} order placed`, {
        message: `${pendingOrder.quantity} ${baseAsset}`,
        tone: 'success',
      });
      if (pendingOrder.side === 'buy') {
        setBuyQty('');
        setBuyPct(0);
      } else {
        setSellQty('');
        setSellPct(0);
      }
      setConfirmVisible(false);
      setPendingOrder(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Order failed';
      setError(message);
      showToast('Order failed', { message, tone: 'error' });
      setConfirmVisible(false);
    }
  };

  const feeLabel =
    buyFeeRate > 0
      ? `${(buyFeeRate * 100).toFixed(3)}% ${orderType === 'limit' && postOnly ? 'maker' : 'taker'}`
      : undefined;

  return (
    <TerminalPanel style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Spot</Text>
        <View style={[styles.badge, { backgroundColor: `hsl(${theme.colors.brandPrimary})`, borderRadius: theme.radius.sm }]}>
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.brandPrimaryForeground})`, fontFamily: theme.fonts.sansSemiBold }]}>
            Terminal
          </Text>
        </View>
        {privateChannelsReady ? (
          <StatusChip label="Orders ready" tone="live" />
        ) : (
          <StatusChip label="Syncing account" tone="sync" pulse />
        )}
        {feeLabel ? <Text style={[styles.fee, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{feeLabel}</Text> : null}
      </View>

      <SegmentControl tabs={ORDER_TYPES.map((t) => ({ id: t.id, label: t.label }))} active={orderType} onChange={(id) => setOrderType(id as OrderType)} />

      {showTif ? (
        <SegmentControl tabs={TIF_OPTIONS.map((t) => ({ id: t.id, label: t.label }))} active={timeInForce} onChange={(id) => setTimeInForce(id as TimeInForce)} />
      ) : null}

      {orderType === 'limit' ? (
        <View style={styles.postOnlyRow}>
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, flex: 1 }]}>Post-only (maker)</Text>
          <Switch
            value={postOnly}
            onValueChange={setPostOnly}
            trackColor={{ false: `hsl(${theme.colors.borderDefault})`, true: `hsl(${theme.colors.brandPrimary})` }}
          />
        </View>
      ) : null}

      {isLimitLike ? (
        <TextField placeholder="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      ) : null}
      {(orderType === 'stop_loss' || orderType === 'stop_limit') && (
        <TextField placeholder="Stop price" value={stopPrice} onChangeText={setStopPrice} keyboardType="decimal-pad" />
      )}
      {orderType === 'trailing_stop_market' && (
        <TextField placeholder="Trailing delta (%)" value={trailingDelta} onChangeText={setTrailingDelta} keyboardType="decimal-pad" />
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dualGrid}>
        <OrderColumn
          side="buy"
          qty={buyQty}
          setQty={setBuyQty}
          percent={buyPct}
          setPercent={setBuyPct}
          balance={quoteBalance}
          asset={quoteAsset}
          refPrice={buyRefPrice}
          qtyPrecision={qtyPrecision}
          feeRate={buyFeeRate}
          quoteAsset={quoteAsset}
          baseAsset={baseAsset}
          onSubmit={requestSubmit}
          loading={place.isPending}
          disabled={!tradingEnabled || place.isPending}
        />
        <OrderColumn
          side="sell"
          qty={sellQty}
          setQty={setSellQty}
          percent={sellPct}
          setPercent={setSellPct}
          balance={baseBalance}
          asset={baseAsset}
          refPrice={sellRefPrice}
          qtyPrecision={qtyPrecision}
          feeRate={sellFeeRate}
          quoteAsset={quoteAsset}
          baseAsset={baseAsset}
          onSubmit={requestSubmit}
          loading={place.isPending}
          disabled={!tradingEnabled || place.isPending}
        />
      </ScrollView>

      {!tradingEnabled ? (
        <ErrorBanner message="Trading paused — market stream not live or market halted" />
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}

      {pendingOrder ? (
        <OrderConfirmSheet
          visible={confirmVisible}
          onClose={() => setConfirmVisible(false)}
          onConfirm={() => void submit()}
          loading={place.isPending}
          order={pendingOrder}
          quoteAsset={quoteAsset}
          baseAsset={baseAsset}
          estimate={null}
          fee={feeLabel}
        />
      ) : null}
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2 },
  fee: { fontSize: 11, marginLeft: 'auto' },
  postOnlyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 36 },
  dualGrid: { gap: 10, paddingBottom: 4 },
  column: { width: 280, borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  colTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  estimate: { fontSize: 12 },
  net: { fontSize: 11, marginBottom: 4 },
});
