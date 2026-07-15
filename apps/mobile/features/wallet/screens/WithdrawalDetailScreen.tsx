import { useEffect, useCallback } from 'react';
import { ScrollView, Text, StyleSheet, View, Pressable, Linking, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenLayout, PrimaryButton, ErrorBanner, ErrorState, SkeletonList } from '@shared/ui';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { clipboardPolicy } from '@core/security/clipboardPolicy';
import { buildWithdrawExplorerUrl, withdrawalStatusLabel } from '@core/domain/wallet/withdraw';
import { useWithdrawals, useCancelWithdrawal } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawalDetail'>;

export function WithdrawalDetailScreen({ route }: Props) {
  const { withdrawalId } = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const qc = useQueryClient();
  const q = useWithdrawals();
  const cancel = useCancelWithdrawal();

  useEffect(() => {
    analytics.screen('S-525');
    void qc.invalidateQueries({ queryKey: ['withdrawals'] });
  }, [withdrawalId, qc]);

  const item = q.data?.pages.flatMap((p) => p.items).find((w) => w.id === withdrawalId);
  const onRefresh = useCallback(() => void q.refetch(), [q]);

  if (q.isLoading && !item) {
    return (
      <ScreenLayout testID="S-525">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  if (!item) {
    return (
      <ScreenLayout testID="S-525">
        {!isOnline ? <ErrorBanner message="Offline — cannot refresh" onRetry={onRefresh} /> : null}
        <ErrorState title="Withdrawal not found" onRetry={onRefresh} />
      </ScreenLayout>
    );
  }

  const txHash = item.txid ?? item.tx_hash ?? '';
  const explorer = buildWithdrawExplorerUrl(txHash, item.chain_name ?? item.chain);
  const status = withdrawalStatusLabel(item.displayStatus ?? item.status);
  const statusColor =
    item.status.toLowerCase() === 'completed'
      ? theme.colors.tradeBuy
      : item.status.toLowerCase() === 'failed'
        ? theme.colors.tradeSell
        : theme.colors.statusWarning;

  const copyTx = async () => {
    if (txHash) await clipboardPolicy.copyWithExpiry(txHash);
  };

  return (
    <ScreenLayout testID="S-525">
      <ScrollView refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={onRefresh} />}>
        {!isOnline ? <ErrorBanner message="Offline — status may be stale" onRetry={onRefresh} /> : null}

        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Withdrawal</Text>
        <View style={[styles.chip, { backgroundColor: `hsl(${statusColor} / 0.12)` }]}>
          <Text style={{ color: `hsl(${statusColor})`, fontWeight: '700' }}>{status}</Text>
        </View>

        <Row label="Asset" value={item.asset ?? item.symbol ?? ''} theme={theme} />
        <Row label="Amount" value={`-${item.quantity ?? item.amount ?? ''}`} theme={theme} />
        {item.fee ? <Row label="Fee" value={item.fee} theme={theme} /> : null}
        {(item.net_amount ?? item.netAmount) ? (
          <Row label="Net amount" value={String(item.net_amount ?? item.netAmount)} theme={theme} />
        ) : null}
        <Row label="Network" value={item.chain_name ?? item.chain ?? '—'} theme={theme} />
        <Row label="Address" value={item.address ?? item.toAddress ?? '—'} theme={theme} mono />
        <Row
          label="Created"
          value={new Date(item.date_time ?? item.createdAt ?? Date.now()).toLocaleString()}
          theme={theme}
        />

        {txHash ? (
          <View style={[styles.txBlock, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>Transaction ID</Text>
            <Text selectable style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: 'monospace', fontSize: 12 }}>
              {txHash}
            </Text>
            <View style={styles.txActions}>
              <PrimaryButton title="Copy TXID" variant="secondary" onPress={() => void copyTx()} />
              {explorer ? (
                <Pressable onPress={() => void Linking.openURL(explorer)} style={[styles.explorerBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
                  <Ionicons name="open-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
                  <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Explorer</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {['pending', 'pending_email_verify', 'pending_approval', 'pending_2fa', 'pending_blockchain', 'processing'].includes(
          item.status,
        ) ? (
          <PrimaryButton
            title={cancel.isPending ? 'Cancelling…' : 'Cancel withdrawal'}
            variant="secondary"
            onPress={() => cancel.mutate(item.id)}
          />
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

function Row({
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
          fontSize: mono ? 11 : 14,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  chip: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  txBlock: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  txActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  explorerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, minHeight: 44 },
});
