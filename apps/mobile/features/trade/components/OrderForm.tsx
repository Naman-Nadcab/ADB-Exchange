import { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TextField, PrimaryButton, SegmentControl, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { validateOrder } from '@core/domain/trade/orderbook';
import { formatPrice } from '@core/domain/markets/formatPrice';
import type { OrderSide, OrderType, PlaceOrderRequest, SpotMarket } from '@exchange/mobile-types';
import { usePlaceOrder } from '../hooks/useTrade';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';

const ORDER_TYPES: { id: OrderType; label: string }[] = [
  { id: 'limit', label: 'Limit' },
  { id: 'market', label: 'Market' },
  { id: 'stop_loss', label: 'Stop' },
  { id: 'stop_limit', label: 'Stop Limit' },
  { id: 'trailing_stop_market', label: 'Trailing' },
];

const PERCENTS = [25, 50, 75, 100];

type Props = {
  symbol: string;
  side: OrderSide;
  market?: SpotMarket;
  availableBalance?: string;
  quoteAsset: string;
  onSideChange: (side: OrderSide) => void;
  onPriceSelect?: (price: string) => void;
  presetPrice?: string;
};

export function OrderForm({
  symbol,
  side,
  market,
  availableBalance = '0',
  quoteAsset,
  onSideChange,
  presetPrice,
}: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailingDelta, setTrailingDelta] = useState('');
  const [error, setError] = useState<string | null>(null);
  const place = usePlaceOrder();

  const effectivePrice = presetPrice ?? price;

  const estimate = useMemo(() => {
    if (!quantity || !effectivePrice) return null;
    const q = parseFloat(quantity);
    const p = parseFloat(effectivePrice);
    if (!Number.isFinite(q) || !Number.isFinite(p)) return null;
    return side === 'buy' ? q : q * p;
  }, [quantity, effectivePrice, side]);

  const applyPercent = (pct: number) => {
    const avail = parseFloat(availableBalance);
    if (!Number.isFinite(avail) || !effectivePrice) return;
    if (side === 'buy') {
      const spend = (avail * pct) / 100;
      setQuantity(String(spend / parseFloat(effectivePrice)));
    } else {
      setQuantity(String((avail * pct) / 100));
    }
  };

  const submit = async () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot place orders');
      return;
    }
    if (!market) {
      setError('Market metadata loading');
      return;
    }
    const req: PlaceOrderRequest = {
      market: symbol,
      side,
      type: orderType,
      quantity,
      price: orderType === 'limit' || orderType === 'stop_limit' ? effectivePrice : undefined,
      stop_price: orderType === 'stop_loss' || orderType === 'stop_limit' ? stopPrice : undefined,
      trailing_delta: orderType === 'trailing_stop_market' ? trailingDelta : undefined,
    };
    const v = validateOrder(req, market);
    if (!v.valid) {
      setError(v.message);
      return;
    }
    try {
      await place.mutateAsync(req);
      setQuantity('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Order failed');
    }
  };

  return (
    <View style={styles.wrap}>
      <SegmentControl
        tabs={[
          { id: 'buy', label: 'Buy' },
          { id: 'sell', label: 'Sell' },
        ]}
        active={side}
        onChange={(id) => onSideChange(id as OrderSide)}
      />
      <SegmentControl
        tabs={ORDER_TYPES.map((t) => ({ id: t.id, label: t.label }))}
        active={orderType}
        onChange={(id) => setOrderType(id as OrderType)}
      />
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginBottom: 8 }}>
        Available: {availableBalance} {quoteAsset}
      </Text>
      {(orderType === 'limit' || orderType === 'stop_limit') && (
        <TextField label="Price" value={effectivePrice} onChangeText={setPrice} keyboardType="decimal-pad" />
      )}
      {(orderType === 'stop_loss' || orderType === 'stop_limit') && (
        <TextField label="Stop price" value={stopPrice} onChangeText={setStopPrice} keyboardType="decimal-pad" />
      )}
      {orderType === 'trailing_stop_market' && (
        <TextField
          label="Trailing %"
          value={trailingDelta}
          onChangeText={setTrailingDelta}
          keyboardType="decimal-pad"
        />
      )}
      <TextField label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
      <View style={styles.percents}>
        {PERCENTS.map((p) => (
          <PrimaryButton key={p} title={`${p}%`} variant="secondary" onPress={() => applyPercent(p)} />
        ))}
      </View>
      {estimate !== null ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
          Est. {side === 'buy' ? 'receive' : 'value'}: {formatPrice(estimate, quoteAsset)}
        </Text>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton
        title={side === 'buy' ? 'Buy' : 'Sell'}
        loading={place.isPending}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  percents: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
});
