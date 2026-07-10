import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { formatUsd } from '@core/domain/wallet/portfolio';

type Props = {
  totalUsd: string;
  change24h?: number | null;
  pnlToday?: number | null;
  fundingUsd?: string;
  tradingUsd?: string;
};

export function PortfolioSummary({ totalUsd, change24h, pnlToday, fundingUsd, tradingUsd }: Props) {
  const { theme } = useTheme();
  const changeColor =
    change24h != null && change24h >= 0 ? theme.colors.tradeBuy : theme.colors.tradeSell;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
        Total Portfolio Value
      </Text>
      <Text style={[styles.total, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        ${formatUsd(totalUsd)}
      </Text>
      {change24h != null ? (
        <Text style={{ color: `hsl(${changeColor})`, fontWeight: '600', marginTop: 4 }}>
          24h {change24h >= 0 ? '+' : ''}
          {change24h.toFixed(2)}%
        </Text>
      ) : null}
      {pnlToday != null ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 2 }}>
          Today PnL: {pnlToday >= 0 ? '+' : ''}${formatUsd(pnlToday)}
        </Text>
      ) : null}
      <View style={styles.breakdown}>
        <View style={styles.col}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>Funding</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
            ${formatUsd(fundingUsd ?? '0')}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>Trading</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
            ${formatUsd(tradingUsd ?? '0')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13 },
  total: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 4 },
  breakdown: { flexDirection: 'row', gap: 24, marginTop: 12 },
  col: { gap: 2 },
});
