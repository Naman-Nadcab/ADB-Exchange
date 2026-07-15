import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
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
    <ExchangeCard elevated style={styles.wrap}>
      <Text style={[styles.eyebrow, { color: `hsl(${theme.colors.brandPrimary})` }]}>
        TOTAL PORTFOLIO
      </Text>
      <Text style={[styles.total, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        ${formatUsd(totalUsd)}
      </Text>
      <View style={styles.pnlRow}>
        {change24h != null ? (
          <View style={[styles.pnlBadge, { backgroundColor: `hsl(${changeColor} / 0.12)` }]}>
            <Ionicons
              name={change24h >= 0 ? 'arrow-up' : 'arrow-down'}
              size={12}
              color={`hsl(${changeColor})`}
            />
            <Text style={{ color: `hsl(${changeColor})`, fontWeight: '700', fontSize: 13 }}>
              24h {change24h >= 0 ? '+' : ''}
              {change24h.toFixed(2)}%
            </Text>
          </View>
        ) : null}
        {pnlToday != null ? (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            Today {pnlToday >= 0 ? '+' : ''}${formatUsd(pnlToday)}
          </Text>
        ) : null}
      </View>
      <View style={[styles.breakdown, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
        <View style={[styles.col, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.45)` }]}>
          <Ionicons name="wallet-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '600', letterSpacing: 0.8 }}>
            FUNDING
          </Text>
          <Text style={[styles.colValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            ${formatUsd(fundingUsd ?? '0')}
          </Text>
        </View>
        <View style={[styles.col, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.45)` }]}>
          <Ionicons name="trending-up" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '600', letterSpacing: 0.8 }}>
            TRADING
          </Text>
          <Text style={[styles.colValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            ${formatUsd(tradingUsd ?? '0')}
          </Text>
        </View>
      </View>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  total: { fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  pnlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  pnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  breakdown: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  col: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  colValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
