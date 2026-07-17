import { useEffect, useRef } from 'react';
import { FlatList, Pressable, Text, StyleSheet, View, Alert, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, SecondaryButton, SkeletonList, EmptyState, ErrorState, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
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
        style={{ marginTop: theme.spacing[2], marginBottom: theme.spacing[1] }}
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
          const sidePalette = semanticStatusPalette(theme.colors, side === 'sell' ? 'sell' : 'buy');
          return (
            <Pressable onPress={() => navigation.navigate('EditAd', { adId: item.id, ad: item })}>
              <ExchangeCard style={{ marginBottom: theme.spacing[2.5], marginTop: theme.spacing[2.5] }}>
                <View style={styles.top}>
                  <Text
                    style={[
                      theme.typography.bodyMd,
                      { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
                    ]}
                  >
                    {item.crypto_symbol}/{fiat}
                  </Text>
                  <View
                    style={[
                      styles.sideBadge,
                      {
                        backgroundColor: sidePalette.bg,
                        borderRadius: theme.radius.sm,
                        paddingHorizontal: theme.spacing[1.5],
                        paddingVertical: theme.spacing[0.5],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.labelSm,
                        { color: sidePalette.fg, fontFamily: theme.fonts.sansBold, textTransform: 'uppercase' },
                      ]}
                    >
                      {side}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    theme.typography.bodyMd,
                    {
                      color: `hsl(${theme.colors.foregroundPrimary})`,
                      fontFamily: theme.fonts.sansBold,
                      marginTop: theme.spacing[1],
                    },
                  ]}
                >
                  {sym}{formatP2pFiatPrice(price, fiat)}
                </Text>
                <Text
                  style={[
                    theme.typography.bodySm,
                    { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
                  ]}
                >
                  Avail {formatP2pCryptoQty(item.available_amount)} {item.crypto_symbol} · {st}
                </Text>
                {payments.length > 0 ? (
                  <Text
                    style={[
                      theme.typography.labelSm,
                      { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
                    ]}
                    numberOfLines={1}
                  >
                    {payments.join(', ')}
                  </Text>
                ) : null}
                <View style={[styles.actions, { gap: theme.spacing[2], marginTop: theme.spacing[3] }]}>
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
              </ExchangeCard>
            </Pressable>
          );
        }}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sideBadge: {},
  actions: { flexDirection: 'row' },
});
