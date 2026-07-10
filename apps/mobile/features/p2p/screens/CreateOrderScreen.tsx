import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { validateOrderQuantity, getAdPrice } from '@core/domain/p2p/order';
import { ApiError } from '@core/api/errors/ApiError';
import { useP2PAds, useCreateP2POrder, useMyPaymentMethods } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'CreateOrder'>;

export function CreateOrderScreen({ navigation, route }: Props) {
  const { adId } = route.params;
  const [quantity, setQuantity] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isOnline = useAppStore((s) => s.isOnline);
  const adsQ = useP2PAds();
  const pmQ = useMyPaymentMethods();
  const create = useCreateP2POrder();

  useEffect(() => {
    analytics.screen('S-602');
  }, []);

  const ad = useMemo(() => adsQ.data?.pages.flat().find((a) => a.id === adId), [adsQ.data, adId]);

  const submit = async () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot create order');
      return;
    }
    if (!ad) return;
    const err = validateOrderQuantity(quantity, ad.min_amount, ad.max_amount, ad.available_amount);
    if (err) {
      setError(err);
      return;
    }
    if (!paymentMethodId) {
      setError('Select a payment method');
      return;
    }
    try {
      const order = await create.mutateAsync({ adId, quantity, paymentMethodId });
      navigation.replace('OrderRoom', { orderId: order.id });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create order');
    }
  };

  if (!ad) {
    return (
      <ScreenLayout testID="S-602">
        <ErrorBanner message="Ad not found" />
      </ScreenLayout>
    );
  }

  const methods = (pmQ.data ?? []).filter((m) => m.is_active !== false);

  return (
    <ScreenLayout testID="S-602">
      <ScrollView>
        <TextField label={`Amount (${ad.crypto_symbol})`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
        <TextField
          label="Payment method ID"
          value={paymentMethodId}
          onChangeText={setPaymentMethodId}
          placeholder={methods[0]?.id ?? 'Add payment method first'}
        />
        <PrimaryButton title="Use first method" variant="secondary" onPress={() => methods[0] && setPaymentMethodId(methods[0].id)} />
        <Text style={{ marginBottom: 12 }}>Price: {getAdPrice(ad)} {ad.fiat_currency}</Text>
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton title="Create Order" loading={create.isPending} onPress={() => void submit()} />
      </ScrollView>
    </ScreenLayout>
  );
}
