import { useEffect } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useWithdrawals, useCancelWithdrawal } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawalDetail'>;

export function WithdrawalDetailScreen({ route }: Props) {
  const { withdrawalId } = route.params;
  const { theme } = useTheme();
  const qc = useQueryClient();
  const q = useWithdrawals();
  const cancel = useCancelWithdrawal();

  useEffect(() => {
    analytics.screen('S-525');
    void qc.invalidateQueries({ queryKey: ['withdrawals'] });
  }, [withdrawalId, qc]);

  const item = q.data?.pages.flatMap((p) => p.items).find((w) => w.id === withdrawalId);

  if (q.isLoading && !item) {
    return (
      <ScreenLayout testID="S-525">
        <Text>Loading…</Text>
      </ScreenLayout>
    );
  }

  if (!item) {
    return (
      <ScreenLayout testID="S-525">
        <Text>Withdrawal not found</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-525">
      <ScrollView>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Withdrawal</Text>
        <Row label="Status" value={item.displayStatus ?? item.status} theme={theme} />
        <Row label="Asset" value={item.asset ?? item.symbol ?? ''} theme={theme} />
        <Row label="Amount" value={item.quantity ?? item.amount ?? ''} theme={theme} />
        <Row label="Address" value={item.address ?? item.toAddress ?? ''} theme={theme} />
        <Row label="TxID" value={item.txid ?? item.tx_hash ?? '—'} theme={theme} />
        {['pending', 'pending_email_verify', 'pending_approval'].includes(item.status) ? (
          <PrimaryButton title="Cancel" variant="secondary" onPress={() => cancel.mutate(item.id)} />
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

function Row({ label, value, theme }: { label: string; value: string; theme: { colors: { foregroundSecondary: string; foregroundPrimary: string } } }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>{label}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
});
