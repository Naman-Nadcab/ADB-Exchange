import { useEffect, useRef } from 'react';
import { FlatList, Pressable, Text, StyleSheet, View, Alert, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, SecondaryButton, SkeletonList, EmptyState, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAdPrice, getAdSide } from '@core/domain/p2p/order';
import { formatFiatSymbol, formatP2pFiatPrice, formatP2pCryptoQty, parseAdPayments } from '@core/domain/p2p/marketplace';
import { useMyP2PAds, useUpdateAd, useDeleteAd } from '../hooks/useP2P';
import type { P2PStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<P2PStackParamList, 'MyAds'>;

export function MyAdsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const q = useMyP2PAds();
  const update = useUpdateAd();
  const del = useDeleteAd();
  const actionLock = useRef(false);

  useEffect(() => {
    analytics.screen('S-607');
  }, []);

  const runLocked = async (fn: () => Promise<unknown>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    try {
      await fn();
    } finally {
      actionLock.current = false;
    }
  };

  if (q.isLoading) {
    return (
      <ScreenLayout testID="S-607">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (q.isError) {
    return (
      <ScreenLayout testID="S-607">
        <ErrorState title="Could not load your ads" onRetry={() => void q.refetch()} />
      </ScreenLayout>
    );
  }

  const rows = q.data ?? [];

  return (
    <ScreenLayout testID="S-607">
      <PrimaryButton title="Post new ad" onPress={() => navigation.navigate('PostAdType')} />
      <SecondaryButton
        title="Merchant dashboard"
        onPress={() => navigation.navigate('MerchantDashboard')}
        style={{ marginTop: 8, marginBottom: 4 }}
      />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
        ListEmptyComponent={
          <EmptyState
            title="No ads yet"
            message="Create your first ad to start trading on the marketplace."
            actionLabel="Post ad"
            onAction={() => navigation.navigate('PostAdType')}
          />
        }
        renderItem={({ item }) => {
          const fiat = item.fiat_currency;
          const sym = formatFiatSymbol(fiat);
          const price = getAdPrice(item);
          const side = getAdSide(item);
          const st = String(item.status ?? 'active');
          const payments = parseAdPayments(item);
          return (
            <Pressable
              style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}
              onPress={() => navigation.navigate('EditAd', { adId: item.id, ad: item })}
            >
              <View style={styles.top}>
                <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                  {item.crypto_symbol}/{fiat}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    color: side === 'sell' ? '#f6465d' : '#0ecb81',
                  }}
                >
                  {side}
                </Text>
              </View>
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: 4 }}>
                {sym}{formatP2pFiatPrice(price, fiat)}
              </Text>
              <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 4 }}>
                Avail {formatP2pCryptoQty(item.available_amount)} {item.crypto_symbol} · {st}
              </Text>
              {payments.length > 0 ? (
                <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 4 }} numberOfLines={1}>
                  {payments.join(', ')}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <SecondaryButton
                  title={st === 'paused' ? 'Resume' : 'Pause'}
                  onPress={() =>
                    void runLocked(() =>
                      update.mutateAsync({ id: item.id, status: st === 'paused' ? 'active' : 'paused' }),
                    )
                  }
                  style={{ flex: 1 }}
                />
                <SecondaryButton
                  title="Edit"
                  onPress={() => navigation.navigate('EditAd', { adId: item.id, ad: item })}
                  style={{ flex: 1 }}
                />
                <SecondaryButton
                  title="Delete"
                  onPress={() =>
                    Alert.alert('Delete ad?', 'This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void runLocked(() => del.mutateAsync(item.id)),
                      },
                    ])
                  }
                  style={{ flex: 1 }}
                />
              </View>
            </Pressable>
          );
        }}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, marginTop: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
