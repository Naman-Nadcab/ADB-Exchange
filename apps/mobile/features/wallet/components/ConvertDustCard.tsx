import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard, PrimaryButton } from '@shared/ui';

type Props = {
  onConvert: () => void;
  isLoading?: boolean;
  result?: { count: number; totalUsdt: string } | null;
};

export function ConvertDustCard({ onConvert, isLoading, result }: Props) {
  const { theme } = useTheme();

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name="sparkles-outline" size={18} color={`hsl(${theme.colors.brandPrimary})`} />
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, flex: 1 }}>
          Convert balances under $1 to USDT
        </Text>
        <PrimaryButton
          title={isLoading ? 'Converting…' : 'Convert Small Balances'}
          variant="secondary"
          loading={isLoading}
          onPress={onConvert}
        />
      </View>
      {result ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 13, marginTop: 8 }}>
          Converted {result.count} asset{result.count !== 1 ? 's' : ''} →{' '}
          <Text style={{ fontWeight: '700' }}>{parseFloat(result.totalUsdt).toFixed(4)} USDT</Text> received
        </Text>
      ) : null}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
