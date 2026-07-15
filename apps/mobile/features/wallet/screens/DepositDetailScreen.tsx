import { useEffect, useCallback } from 'react';
import { ScrollView, Text, StyleSheet, View, Pressable, Linking, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SkeletonList, ErrorState, ErrorBanner, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { Ionicons } from '@expo/vector-icons';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { clipboardPolicy } from '@core/security/clipboardPolicy';
import { buildDepositExplorerUrl, depositStatusLabel } from '@core/domain/wallet/deposit';
import { useDepositDetail } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositDetail'>;

export function DepositDetailScreen({ route }: Props) {
  const { txHash } = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const q = useDepositDetail(txHash);

  useEffect(() => {
    analytics.screen('S-514');
  }, []);

  const onRefresh = useCallback(() => void q.refetch(), [q]);

  const onCopyTx = async () => {
    await clipboardPolicy.copyWithExpiry(txHash);
  };

  if (q.isLoading && !q.data) {
    return (
      <ScreenLayout testID="S-514">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  const d = q.data;
  if (q.isError || !d) {
    return (
      <ScreenLayout testID="S-514">
        {!isOnline ? <ErrorBanner message="Offline — cannot refresh deposit status" onRetry={onRefresh} /> : null}
        <ErrorState title="Deposit not found" message="This transaction could not be loaded." onRetry={onRefresh} />
      </ScreenLayout>
    );
  }

  const explorer =
    d.explorerUrl ?? buildDepositExplorerUrl(d.txHash, d.chainSymbol);
  const statusLabel = depositStatusLabel(d.status, d.confirmations, d.requiredConfirmations);
  const statusColor =
    d.status.toLowerCase() === 'completed' || d.status.toLowerCase() === 'confirmed'
      ? theme.colors.tradeBuy
      : d.status.toLowerCase() === 'failed'
        ? theme.colors.tradeSell
        : theme.colors.statusWarning;

  return (
    <ScreenLayout testID="S-514">
      <ScrollView refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={onRefresh} />}>
        {!isOnline ? <ErrorBanner message="Offline — status may be stale" onRetry={onRefresh} /> : null}

        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {d.symbol} Deposit
        </Text>
        <View style={[styles.statusChip, { backgroundColor: `hsl(${statusColor} / 0.12)` }]}>
          <Text style={{ color: `hsl(${statusColor})`, fontWeight: '700' }}>{statusLabel}</Text>
        </View>

        <Detail label="Amount" value={`+${d.amount} ${d.symbol}`} theme={theme} />
        <Detail label="Network" value={d.chainName ?? '—'} theme={theme} />
        <Detail label="Confirmations" value={`${d.confirmations}/${d.requiredConfirmations}`} theme={theme} />
        <Detail label="To address" value={d.toAddress ?? '—'} theme={theme} mono />
        <Detail label="From address" value={d.fromAddress ?? '—'} theme={theme} mono />
        <Detail label="Created" value={new Date(d.createdAt).toLocaleString()} theme={theme} />
        {d.creditedAt ? <Detail label="Credited" value={new Date(d.creditedAt).toLocaleString()} theme={theme} /> : null}

        <View style={[styles.txBlock, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginBottom: 6 }}>Transaction ID</Text>
          <Text selectable style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: 'monospace', fontSize: 12 }}>
            {d.txHash}
          </Text>
          <View style={styles.txActions}>
            <PrimaryButton title="Copy TXID" variant="secondary" onPress={() => void onCopyTx()} />
            {explorer ? (
              <Pressable
                onPress={() => void Linking.openURL(explorer)}
                style={[styles.explorerBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
              >
                <Ionicons name="open-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
                <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Explorer</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

function Detail({
  label,
  value,
  theme,
  mono,
}: {
  label: string;
  value: string;
  theme: { colors: { foregroundSecondary: string; foregroundPrimary: string } };
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

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  statusChip: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  txBlock: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  txActions: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  explorerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
});
