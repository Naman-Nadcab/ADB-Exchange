import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  TextField,
  PrimaryButton,
  SegmentControl,
  ErrorBanner,
  TerminalPanel,
  TradeSideToggle,
  PercentageSlider,
  BalanceCard,
} from '@shared/ui';
import { useTheme, hapticMedium } from '@shared/theme';
import { validateOrder } from '@core/domain/trade/orderbook';
import { formatPrice } from '@core/domain/markets/formatPrice';
import type { OrderSide, OrderType, PlaceOrderRequest, SpotMarket } from '@exchange/mobile-types';
import { usePlaceOrder } from '../hooks/useTrade';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import { OrderConfirmSheet } from './OrderConfirmSheet';

const ORDER_TYPES: { id: OrderType; label: string }[] = [
  { id: 'limit', label: 'Limit' },
  { id: 'market', label: 'Market' },
  { id: 'stop_loss', label: 'Stop' },
];

type Props = {
  symbol: string;
  side: OrderSide;
  market?: SpotMarket;
  availableBalance?: string;
  quoteAsset: string;
  baseAsset: string;
  onSideChange: (side: OrderSide) => void;
  presetPrice?: string;
};

export function OrderForm({
  symbol,
  side,
  market,
  availableBalance = '0',
  quoteAsset,
  baseAsset,
  onSideChange,
  presetPrice,
}: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PlaceOrderRequest | null>(null);
  const place = usePlaceOrder();

  const effectivePrice = presetPrice ?? price;

  useEffect(() => {
    if (presetPrice) setPrice(presetPrice);
  }, [presetPrice]);

  const estimate = useMemo(() => {
    if (!quantity || !effectivePrice) return null;
    const q = parseFloat(quantity);
    const p = parseFloat(effectivePrice);
    if (!Number.isFinite(q) || !Number.isFinite(p)) return null;
    const total = side === 'buy' ? q * p : q * p;
    return formatPrice(total, '');
  }, [quantity, effectivePrice, side]);

  const maxLabel = useMemo(() => {
    if (side === 'buy' && effectivePrice) {
      const avail = parseFloat(availableBalance);
      const p = parseFloat(effectivePrice);
      if (Number.isFinite(avail) && Number.isFinite(p) && p > 0) {
        return `Max buy: ${formatPrice(avail / p, baseAsset)}`;
      }
    }
    if (side === 'sell') {
      return `Max sell: ${availableBalance} ${baseAsset}`;
    }
    return undefined;
  }, [side, availableBalance, effectivePrice, baseAsset]);

  const applyPercent = (pct: number) => {
    setPercent(pct);
    const avail = parseFloat(availableBalance);
    if (!Number.isFinite(avail)) return;
    if (side === 'buy') {
      if (!effectivePrice) return;
      const p = parseFloat(effectivePrice);
      if (!Number.isFinite(p) || p <= 0) return;
      setQuantity(String((avail * pct) / 100 / p));
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
      price: orderType === 'limit' || orderType === 'stop_limit' ? effectivePrice : undefined,
      stop_price: orderType === 'stop_loss' || orderType === 'stop_limit' ? stopPrice : undefined,
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
      setQuantity('');
      setPercent(0);
      setConfirmVisible(false);
      setPendingOrder(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Order failed');
      setConfirmVisible(false);
    }
  };

  const makerFee = market?.maker_fee ? `${(parseFloat(market.maker_fee) * 100).toFixed(3)}%` : undefined;

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

      <BalanceCard
        label="Available balance"
        available={availableBalance}
        asset={side === 'buy' ? quoteAsset : baseAsset}
        secondary={maxLabel}
      />

      {(orderType === 'limit' || orderType === 'stop_limit') && (
        <TextField placeholder="Price" value={effectivePrice} onChangeText={setPrice} keyboardType="decimal-pad" />
      )}
      {orderType === 'stop_loss' && (
        <TextField placeholder="Stop price" value={stopPrice} onChangeText={setStopPrice} keyboardType="decimal-pad" />
      )}
      <TextField placeholder={`Amount (${baseAsset})`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />

      <PercentageSlider value={percent} onChange={applyPercent} />

      {estimate !== null ? (
        <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: theme.spacing[3] }]}>
          Est. {side === 'buy' ? 'cost' : 'receive'}: {estimate} {quoteAsset}
          {makerFee ? ` · Fee ~${makerFee}` : ''}
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
          fee={makerFee}
        />
      ) : null}
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2 },
});
