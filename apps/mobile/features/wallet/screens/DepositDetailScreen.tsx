import { useEffect } from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SkeletonList } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useDepositDetail } from '../hooks/useBlockchainWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'DepositDetail'>;

export function DepositDetailScreen({ route }: Props) {
  const { txHash } = route.params;
  const { theme } = useTheme();
  const q = useDepositDetail(txHash);

  useEffect(() => {
    analytics.screen('S-514');
  }, []);

  if (q.isLoading) {
    return (
      <ScreenLayout testID="S-514">
        <SkeletonList rows={6} />
      </ScreenLayout>
    );
  }

  const d = q.data;
  if (!d) {
    return (
      <ScreenLayout testID="S-514">
        <Text>Deposit not found</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-514">
      <ScrollView>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {d.symbol} Deposit
        </Text>
        <Detail label="Status" value={d.status} theme={theme} />
        <Detail label="Amount" value={d.amount} theme={theme} />
        <Detail label="Confirmations" value={`${d.confirmations}/${d.requiredConfirmations}`} theme={theme} />
        <Detail label="Tx Hash" value={d.txHash} theme={theme} />
        <Detail label="To" value={d.toAddress ?? ''} theme={theme} />
        <Detail label="Network" value={d.chainName ?? ''} theme={theme} />
        <Detail label="Created" value={new Date(d.createdAt).toLocaleString()} theme={theme} />
      </ScrollView>
    </ScreenLayout>
  );
}

function Detail({ label, value, theme }: { label: string; value: string; theme: { colors: { foregroundSecondary: string; foregroundPrimary: string } } }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>{label}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
});
