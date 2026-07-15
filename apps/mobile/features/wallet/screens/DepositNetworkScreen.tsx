import { useEffect, useMemo } from 'react';
import { FlatList, Pressable, Text, StyleSheet, RefreshControl, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SkeletonList, ErrorState, ErrorBanner, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { formatNetworkLabel } from '@core/domain/wallet/withdraw';
import {
  estimateArrivalTime,
  isChainDepositEnabled,
  pickRecommendedChain,
} from '@core/domain/wallet/deposit';
import { useTokenChains, useDepositTokens } from '../hooks/useBlockchainWallet';
import { DepositFlowHeader } from '../components/DepositFlowHeader';
import type { WalletStackParamList } from '../navigation/types';
import type { WalletChain } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositNetwork'>;

export function DepositNetworkScreen({ route, navigation }: Props) {
  const { symbol } = route.params;
  const name = route.params.name ?? symbol;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const q = useTokenChains(symbol);
  const tokensQ = useDepositTokens();
  const token = tokensQ.data?.find((t) => t.symbol === symbol);
  const recommended = useMemo(() => pickRecommendedChain(q.data ?? []), [q.data]);

  useEffect(() => {
    analytics.screen('S-511');
  }, []);

  const onRefresh = () => {
    void q.refetch();
    void tokensQ.refetch();
  };

  const renderChain = ({ item, index }: { item: WalletChain; index: number }) => {
    const enabled = isChainDepositEnabled(item);
    const isRecommended = recommended?.id === item.id;
    return (
      <Pressable
        style={[
          styles.row,
          !enabled && styles.disabled,
          index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
        ]}
        disabled={!enabled}
        onPress={() =>
          navigation.navigate('DepositAddress', {
            symbol,
            chainId: item.id,
            chainName: item.name,
            chainType: item.type,
            confirmations: item.confirmations_required,
          })
        }
        accessibilityLabel={`Network ${item.name}${!enabled ? ' maintenance' : ''}`}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.labelRow}>
            <Text
              style={{
                color: `hsl(${enabled ? theme.colors.foregroundPrimary : theme.colors.foregroundSecondary})`,
                fontWeight: '700',
              }}
            >
              {formatNetworkLabel(item.name, item.confirmations_required)}
            </Text>
            {isRecommended && enabled ? (
              <View style={[styles.badge, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.15)` }]}>
                <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 10, fontWeight: '700' }}>Recommended</Text>
              </View>
            ) : null}
            {!enabled ? (
              <View style={[styles.badge, { backgroundColor: `hsl(${theme.colors.statusWarning} / 0.15)` }]}>
                <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 10, fontWeight: '700' }}>Maintenance</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            {item.type?.toUpperCase() ?? '—'} · Est. arrival {estimateArrivalTime(item.confirmations_required, item.type)}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
            {enabled ? 'Deposit enabled' : 'Deposit paused'} · Network fee may apply on source wallet
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenLayout testID="S-511">
      <DepositFlowHeader symbol={symbol} name={name} step="Step 2 · Choose network" depositEnabled />
      {!isOnline ? <ErrorBanner message="Offline — network list may be stale" onRetry={onRefresh} /> : null}
      <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12, marginBottom: 12 }}>
        Sending on the wrong network may result in permanent loss of funds.
      </Text>
      {token?.withdrawal_fee ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginBottom: 10 }}>
          Reference fee: {token.withdrawal_fee} {symbol} (withdrawal reference)
        </Text>
      ) : null}

      {q.isLoading && !q.data ? (
        <SkeletonList rows={4} />
      ) : q.isError ? (
        <ErrorState title="Could not load networks" message={`No chains available for ${symbol}.`} onRetry={onRefresh} />
      ) : (
        <ExchangeCard variant="terminal" style={styles.card}>
          <FlatList
            data={q.data ?? []}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={onRefresh} />}
            renderItem={renderChain}
            ListEmptyComponent={
              <ErrorState
                title="No supported networks"
                message={`${symbol} is not available on any network. Try another asset or contact support.`}
                onRetry={onRefresh}
              />
            }
          />
        </ExchangeCard>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 0, paddingHorizontal: 0, flex: 1 },
  row: { paddingHorizontal: 16, paddingVertical: 14, minHeight: 44 },
  disabled: { opacity: 0.45 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
});
