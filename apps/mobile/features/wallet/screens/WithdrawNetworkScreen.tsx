import { useEffect } from 'react';
import { FlatList, Pressable, Text, StyleSheet, RefreshControl, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SkeletonList, ErrorState, ErrorBanner, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { formatNetworkLabel } from '@core/domain/wallet/withdraw';
import { estimateArrivalTime, isChainDepositEnabled, pickRecommendedChain } from '@core/domain/wallet/deposit';
import { useTokenChains, useWithdrawalFee, useFundingBalanceForSymbol } from '../hooks/useBlockchainWallet';
import { WithdrawFlowHeader } from '../components/WithdrawFlowHeader';
import type { WalletStackParamList } from '../navigation/types';
import type { WalletChain } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawNetwork'>;

export function WithdrawNetworkScreen({ route, navigation }: Props) {
  const { symbol, name } = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const chainsQ = useTokenChains(symbol);
  const balanceQ = useFundingBalanceForSymbol(symbol);
  const recommended = pickRecommendedChain(chainsQ.data ?? []);

  useEffect(() => {
    analytics.screen('S-521N');
  }, []);

  const onRefresh = () => {
    void chainsQ.refetch();
    void balanceQ.refetch();
  };

  const renderChain = ({ item, index }: { item: WalletChain; index: number }) => {
    const enabled = isChainDepositEnabled(item);
    const isRecommended = recommended?.id === item.id;
    return (
      <ChainFeeRow symbol={symbol} chain={item} enabled={enabled} isRecommended={isRecommended} index={index} theme={theme}
        onPress={() =>
          enabled &&
          navigation.navigate('WithdrawForm', {
            symbol,
            name,
            chainId: item.id,
            chainName: item.name,
            chainType: item.type,
            confirmations: item.confirmations_required,
          })
        }
      />
    );
  };

  return (
    <ScreenLayout testID="S-521N">
      <WithdrawFlowHeader
        symbol={symbol}
        name={name}
        available={balanceQ.available}
        withdrawEnabled
        step="Step 2 · Choose network"
      />
      {!isOnline ? <ErrorBanner message="Offline — network list may be stale" onRetry={onRefresh} /> : null}
      <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12, marginBottom: 12 }}>
        Select the same network as the destination wallet. Wrong network withdrawals may be lost.
      </Text>
      {chainsQ.isLoading && !chainsQ.data ? (
        <SkeletonList rows={4} />
      ) : chainsQ.isError ? (
        <ErrorState title="Could not load networks" onRetry={onRefresh} />
      ) : (
        <ExchangeCard variant="terminal" style={styles.card}>
          <FlatList
            data={chainsQ.data ?? []}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={chainsQ.isFetching} onRefresh={onRefresh} />}
            renderItem={renderChain}
            ListEmptyComponent={<ErrorState title="No networks" message={`${symbol} has no withdraw networks configured.`} onRetry={onRefresh} />}
          />
        </ExchangeCard>
      )}
    </ScreenLayout>
  );
}

function ChainFeeRow({
  symbol,
  chain,
  enabled,
  isRecommended,
  index,
  theme,
  onPress,
}: {
  symbol: string;
  chain: WalletChain;
  enabled: boolean;
  isRecommended: boolean;
  index: number;
  theme: ReturnType<typeof useTheme>['theme'];
  onPress: () => void;
}) {
  const feeQ = useWithdrawalFee(symbol, chain.id);
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      style={[
        styles.row,
        !enabled && styles.disabled,
        index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.labelRow}>
          <Text style={{ color: `hsl(${enabled ? theme.colors.foregroundPrimary : theme.colors.foregroundSecondary})`, fontWeight: '700' }}>
            {formatNetworkLabel(chain.name, chain.confirmations_required)}
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
          Est. arrival {estimateArrivalTime(chain.confirmations_required, chain.type)}
          {feeQ.data ? ` · Fee ${feeQ.data.fee} ${symbol}` : ''}
          {feeQ.data ? ` · Min ${feeQ.data.minWithdrawal} ${symbol}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 0, paddingHorizontal: 0, flex: 1 },
  row: { paddingHorizontal: 16, paddingVertical: 14, minHeight: 44 },
  disabled: { opacity: 0.45 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
});
