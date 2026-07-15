import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import {
  TextField,
  PrimaryButton,
  SegmentControl,
  ErrorBanner,
  TerminalPanel,
  TradeSideToggle,
  PercentageSlider,
  BalanceCard,
  showToast,
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
  side: OrderSide;
  market?: SpotMarket;
  availableBalance?: string;
  quoteAsset: string;
  baseAsset: string;
  lastPrice?: string | null;
  orderbook?: OrderbookSnapshot;
  onSideChange: (side: OrderSide) => void;
  presetPrice?: string;
  presetQuantity?: string;
};

function newClientOrderId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function OrderForm({
  symbol,
  side,
  market,
  availableBalance = '0',
  quoteAsset,
  baseAsset,
  lastPrice,
  orderbook,
  onSideChange,
  presetPrice,
  presetQuantity,
}: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('gtc');
  const [postOnly, setPostOnly] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailingDelta, setTrailingDelta] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PlaceOrderRequest | null>(null);
  const place = usePlaceOrder();

  useEffect(() => {
    if (presetPrice) setPrice(presetPrice);
  }, [presetPrice]);

  useEffect(() => {
    if (presetQuantity) setQuantity(presetQuantity);
  }, [presetQuantity]);

  useEffect(() => {
    if (orderType !== 'limit') setPostOnly(false);
    if (orderType !== 'limit' && orderType !== 'stop_limit') setTimeInForce('gtc');
  }, [orderType]);

  useEffect(() => {
    if (postOnly) setTimeInForce('gtc');
  }, [postOnly]);

  const isLimitLike = orderType === 'limit' || orderType === 'stop_limit';
  const isMarketLike =
    orderType === 'market' || orderType === 'stop_loss' || orderType === 'trailing_stop_market';
  const showTif = orderType === 'limit' || orderType === 'stop_limit';

  const refPriceNum = useMemo(() => {
    if (isLimitLike) {
      const input = parseFloat(price);
      if (Number.isFinite(input) && input > 0) return input;
      const live = lastPrice ? parseFloat(lastPrice) : NaN;
      return Number.isFinite(live) ? live : 0;
    }
    return marketRefPrice(side, orderbook, lastPrice);
  }, [isLimitLike, price, lastPrice, side, orderbook]);

  const notional = useMemo(() => {
    if (!quantity || refPriceNum <= 0) return 0;
    const q = parseFloat(quantity);
    return Number.isFinite(q) && q > 0 ? q * refPriceNum : 0;
  }, [quantity, refPriceNum]);

  const estimate = notional > 0 ? formatPrice(notional, '') : null;

  const maxLabel = useMemo(() => {
    if (side === 'buy') {
      const avail = parseFloat(availableBalance);
      if (Number.isFinite(avail) && refPriceNum > 0) {
        return `Max buy: ${formatPrice(avail / refPriceNum, baseAsset)}`;
      }
    }
    if (side === 'sell') {
      return `Max sell: ${availableBalance} ${baseAsset}`;
    }
    return undefined;
  }, [side, availableBalance, refPriceNum, baseAsset]);

  const makerFeeRate = normalizeFeeRate(market?.maker_fee);
  const takerFeeRate = normalizeFeeRate(market?.taker_fee);
  const feeRate = orderType === 'limit' && postOnly ? makerFeeRate : takerFeeRate;
  const feeAmount = notional > 0 ? notional * feeRate : 0;
  const netReceive =
    side === 'buy'
      ? parseFloat(quantity || '0') * Math.max(0, 1 - feeRate)
      : notional - feeAmount;

  const feeLabel =
    feeRate > 0
      ? `${(feeRate * 100).toFixed(3)}% ${orderType === 'limit' && postOnly ? 'maker' : 'taker'}`
      : undefined;

  const executionHint = isMarketLike ? 'Top-of-book est.' : orderType === 'stop_limit' ? 'Triggered limit' : postOnly ? 'Post-only maker' : 'Limit on book';

  const minNotionalWarning =
    market?.min_notional && notional > 0 && notional < parseFloat(market.min_notional)
      ? `Below min notional ${market.min_notional} ${quoteAsset}`
      : null;

  const applyPercent = (pct: number) => {
    setPercent(pct);
    const avail = parseFloat(availableBalance);
    if (!Number.isFinite(avail)) return;
    if (side === 'buy') {
      if (refPriceNum <= 0) return;
      setQuantity(String((avail * pct) / 100 / refPriceNum));
    } else {
      setQuantity(String((avail * pct) / 100));
    }
  };

  const buildOrder = (): PlaceOrderRequest | null => {
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
  };

  const requestConfirm = () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot place orders');
      return;
    }
    if (minNotionalWarning && isLimitLike) {
      setError(minNotionalWarning);
      return;
    }
    const req = buildOrder();
    if (!req) return;
    setPendingOrder(req);
    setConfirmVisible(true);
  };

  const submit = async () => {
    if (!pendingOrder) return;
    try {
      await place.mutateAsync(pendingOrder);
      void hapticMedium();
      showToast(`${side === 'buy' ? 'Buy' : 'Sell'} order placed`, {
        message: `${quantity} ${baseAsset} · ${ORDER_TYPES.find((t) => t.id === orderType)?.label ?? orderType}`,
        tone: 'success',
      });
      setQuantity('');
      setPercent(0);
      setConfirmVisible(false);
      setPendingOrder(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Order failed';
      setError(message);
      showToast('Order failed', { message, tone: 'error' });
      setConfirmVisible(false);
    }
  };

  return (
    <TerminalPanel style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Trade</Text>
        <View style={[styles.badge, { backgroundColor: `hsl(${theme.colors.brandPrimary})`, borderRadius: theme.radius.sm }]}>
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.brandPrimaryForeground})`, fontFamily: theme.fonts.sansSemiBold }]}>
            Spot
          </Text>
        </View>
      </View>

      <TradeSideToggle side={side} onChange={onSideChange} />
      <SegmentControl
        tabs={ORDER_TYPES.map((t) => ({ id: t.id, label: t.label }))}
        active={orderType}
        onChange={(id) => setOrderType(id as OrderType)}
      />

      {showTif ? (
        <SegmentControl
          tabs={TIF_OPTIONS.map((t) => ({ id: t.id, label: t.label }))}
          active={timeInForce}
          onChange={(id) => setTimeInForce(id as TimeInForce)}
        />
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

      <BalanceCard
        label="Available balance"
        available={availableBalance}
        asset={side === 'buy' ? quoteAsset : baseAsset}
        secondary={maxLabel}
      />

      {isLimitLike ? (
        <TextField placeholder="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      ) : null}
      {(orderType === 'stop_loss' || orderType === 'stop_limit') && (
        <TextField placeholder="Stop price" value={stopPrice} onChangeText={setStopPrice} keyboardType="decimal-pad" />
      )}
      {orderType === 'trailing_stop_market' && (
        <TextField placeholder="Trailing delta (%)" value={trailingDelta} onChangeText={setTrailingDelta} keyboardType="decimal-pad" />
      )}
      <TextField placeholder={`Amount (${baseAsset})`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />

      <PercentageSlider value={percent} onChange={applyPercent} />

      {estimate !== null ? (
        <View style={{ marginBottom: theme.spacing[3] }}>
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Est. {side === 'buy' ? 'cost' : 'receive'}: {estimate} {quoteAsset}
            {feeLabel ? ` · Fee ~${feeLabel}` : ''}
            {feeAmount > 0 ? ` (~${formatPrice(feeAmount, quoteAsset)})` : ''}
          </Text>
          {netReceive > 0 ? (
            <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 4 }]}>
              Net {side === 'buy' ? baseAsset : quoteAsset}: {formatPrice(netReceive, side === 'buy' ? baseAsset : quoteAsset)} · {executionHint}
            </Text>
          ) : null}
        </View>
      ) : null}

      {minNotionalWarning ? (
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.statusWarning})`, marginBottom: theme.spacing[2] }]}>
          {minNotionalWarning}
        </Text>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      <PrimaryButton
        title={side === 'buy' ? `Buy ${baseAsset}` : `Sell ${baseAsset}`}
        variant={side === 'buy' ? 'buy' : 'sell'}
        loading={place.isPending}
        onPress={requestConfirm}
      />

      {pendingOrder ? (
        <OrderConfirmSheet
          visible={confirmVisible}
          onClose={() => setConfirmVisible(false)}
          onConfirm={() => void submit()}
          loading={place.isPending}
          order={pendingOrder}
          quoteAsset={quoteAsset}
          baseAsset={baseAsset}
          estimate={estimate}
          fee={feeLabel}
        />
      ) : null}
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2 },
  postOnlyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, minHeight: 36 },
});
