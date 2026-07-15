import { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, Text, StyleSheet, View, Share } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ErrorBanner, ErrorState, SkeletonList, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { clipboardPolicy } from '@core/security/clipboardPolicy';
import { transferAccountLabel, transferStatusLabel } from '@core/domain/wallet/transfer';
import { buildWalletHistoryTimeline } from '@core/domain/wallet/walletHistory';
import { useTransferHistory } from '../hooks/useWallet';
import { WalletHistoryTimeline } from '../components/WalletHistoryTimeline';
import { WalletHistoryStatusChip } from '../components/WalletHistoryStatusChip';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'TransferDetail'>;

function DetailRow({
  label,
  value,
  theme,
  mono,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>{label}</Text>
      <Text
        style={{
          color: `hsl(${theme.colors.foregroundPrimary})`,
          fontWeight: '600',
          flex: 1,
          textAlign: 'right',
          fontFamily: mono ? 'monospace' : undefined,
          fontSize: mono ? 12 : 14,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function TransferDetailScreen({ route }: Props) {
  const { transferId } = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const q = useTransferHistory();

  useEffect(() => {
    analytics.screen('S-533');
  }, []);

  const item = useMemo(
    () => q.data?.pages.flatMap((p) => p.items).find((t) => t.id === transferId),
    [q.data, transferId],
  );

  useEffect(() => {
    if (item || q.isLoading) return;
    if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  }, [item, q.isLoading, q.hasNextPage, q.isFetchingNextPage, q]);

  const pendingLookup = !item && (q.isLoading || q.isFetchingNextPage || !!q.hasNextPage);
  const onRefresh = useCallback(() => void q.refetch(), [q]);

  if (pendingLookup) {
    return (
      <ScreenLayout testID="S-533">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (!item) {
    return (
      <ScreenLayout testID="S-533">
        {!isOnline ? <ErrorBanner message="Offline — cannot refresh" onRetry={onRefresh} /> : null}
        <ErrorState title="Transfer not found" onRetry={onRefresh} />
      </ScreenLayout>
    );
  }

  const timeline = buildWalletHistoryTimeline(item.status, 'transfer');
  const shareText = `Transfer ${item.symbol}: ${item.amount}\n${item.description}\nStatus: ${transferStatusLabel(item.status)}`;

  return (
    <ScreenLayout testID="S-533">
      <ScrollView>
        {!isOnline ? <ErrorBanner message="Offline — status may be stale" onRetry={onRefresh} /> : null}

        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Internal Transfer</Text>
        <WalletHistoryStatusChip label={transferStatusLabel(item.status)} status={item.status} />

        <DetailRow label="Amount" value={`${item.direction === 'received' ? '+' : '-'}${item.amount} ${item.symbol}`} theme={theme} />
        <DetailRow label="From" value={transferAccountLabel(item.fromAccount)} theme={theme} />
        <DetailRow label="To" value={transferAccountLabel(item.toAccount)} theme={theme} />
        <DetailRow label="Description" value={item.description} theme={theme} />
        <DetailRow label="Created" value={new Date(item.createdAt).toLocaleString()} theme={theme} />

        <WalletHistoryTimeline steps={timeline} />

        <View style={styles.actions}>
          <PrimaryButton title="Copy details" variant="secondary" onPress={() => void clipboardPolicy.copyWithExpiry(shareText)} />
          <PrimaryButton title="Share" variant="secondary" onPress={() => void Share.share({ message: shareText })} />
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
});
