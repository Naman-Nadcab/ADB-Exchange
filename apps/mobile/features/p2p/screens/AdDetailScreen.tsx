import { useEffect, useMemo } from 'react';
import { ScrollView, Text, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAdPrice, getAdSide } from '@core/domain/p2p/order';
import { useP2PAds } from '../hooks/useP2P';
import { useGuestAccess } from '@features/auth';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'AdDetail'>;

export function AdDetailScreen({ navigation, route }: Props) {
  const { adId } = route.params;
  const { theme } = useTheme();
  const { requireAuth } = useGuestAccess();
  const q = useP2PAds();

  useEffect(() => {
    analytics.screen('S-601');
  }, []);

  const ad = useMemo(() => q.data?.pages.flat().find((a) => a.id === adId), [q.data, adId]);

  if (!ad) {
    return (
      <ScreenLayout testID="S-601">
        <Text>Loading ad…</Text>
      </ScreenLayout>
    );
  }

  const side = getAdSide(ad);
  return (
    <ScreenLayout testID="S-601">
      <ScrollView>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {ad.username} · {side.toUpperCase()} {ad.crypto_symbol}
        </Text>
        <Text>Price: {getAdPrice(ad)} {ad.fiat_currency}</Text>
        <Text>Available: {ad.available_amount}</Text>
        <Text>Limits: {ad.min_amount} – {ad.max_amount} {ad.fiat_currency}</Text>
        <Text>Completion: {ad.merchant_completion_rate ?? '—'}%</Text>
        <Text>Payment window: {ad.payment_time_limit ?? 15} min</Text>
        {ad.terms_and_conditions || ad.remarks ? (
          <Text style={styles.terms}>{ad.terms_and_conditions ?? ad.remarks}</Text>
        ) : null}
        {ad.user_id ? (
          <Pressable onPress={() => navigation.navigate('MerchantProfile', { advertiserId: ad.user_id! })}>
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>View merchant profile</Text>
          </Pressable>
        ) : null}
        <PrimaryButton
          title={side === 'sell' ? 'Buy' : 'Sell'}
          onPress={() => {
            if (!requireAuth()) return;
            navigation.navigate('CreateOrder', { adId });
          }}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  terms: { marginTop: 12, fontSize: 12 },
});
