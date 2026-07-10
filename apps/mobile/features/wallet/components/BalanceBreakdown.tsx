import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { formatUsd } from '@core/domain/wallet/portfolio';

type Props = {
  availableUsd: string;
  lockedUsd: string;
  availableBtc?: string;
  lockedBtc?: string;
};

export function BalanceBreakdown({ availableUsd, lockedUsd, availableBtc, lockedBtc }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Balance Breakdown
      </Text>
      <View style={styles.row}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>Available</Text>
        <Text style={{ color: `hsl(${theme.colors.tradeBuy})`, fontWeight: '600' }}>
          ${formatUsd(availableUsd)}
          {availableBtc ? ` · ${availableBtc} BTC` : ''}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>Locked / In Use</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
          ${formatUsd(lockedUsd)}
          {lockedBtc ? ` · ${lockedBtc} BTC` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12, padding: 12, borderRadius: 8 },
  title: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
