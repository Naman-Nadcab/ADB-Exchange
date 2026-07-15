import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { Avatar } from '@shared/ui';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';
import { pnlSign } from '@core/domain/wallet/pnl';
import type { PnlAsset } from '@exchange/mobile-types';

type Props = {
  totalPnl: number;
  totalPnlPercent: number;
  bestPerformer: PnlAsset | null;
  worstPerformer: PnlAsset | null;
  showBalances: boolean;
};

function pnlColor(theme: ReturnType<typeof useTheme>['theme'], value: number): string {
  if (value > 0) return `hsl(${theme.colors.tradeBuy})`;
  if (value < 0) return `hsl(${theme.colors.tradeSell})`;
  return `hsl(${theme.colors.foregroundSecondary})`;
}

export function PnlSummaryCards({
  totalPnl,
  totalPnlPercent,
  bestPerformer,
  worstPerformer,
  showBalances,
}: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.grid}>
      <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
        <View style={[styles.iconWrap, { backgroundColor: totalPnl >= 0 ? `hsl(${theme.colors.tradeBuy} / 0.12)` : `hsl(${theme.colors.tradeSell} / 0.12)` }]}>
          <Ionicons
            name={totalPnl >= 0 ? 'arrow-up-outline' : 'arrow-down-outline'}
            size={20}
            color={pnlColor(theme, totalPnl)}
          />
        </View>
        <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Total P&L</Text>
        <Text style={[styles.value, { color: pnlColor(theme, totalPnl) }]}>
          {maskBalance(`${pnlSign(totalPnl)}$${formatUsd(Math.abs(totalPnl))}`, showBalances)}
        </Text>
      </View>

      <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
        <View style={[styles.iconWrap, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}>
          <Ionicons name="bar-chart-outline" size={20} color={`hsl(${theme.colors.brandPrimary})`} />
        </View>
        <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>ROI</Text>
        <Text style={[styles.value, { color: pnlColor(theme, totalPnlPercent) }]}>
          {maskBalance(`${pnlSign(totalPnlPercent)}${formatUsd(totalPnlPercent)}%`, showBalances)}
        </Text>
      </View>

      <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
        <View style={[styles.iconWrap, { backgroundColor: `hsl(${theme.colors.tradeBuy} / 0.12)` }]}>
          <Ionicons name="trophy-outline" size={20} color={`hsl(${theme.colors.tradeBuy})`} />
        </View>
        <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Best Performer</Text>
        {bestPerformer ? (
          <View style={styles.performerRow}>
            <Avatar name={bestPerformer.symbol} size="sm" />
            <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>{bestPerformer.symbol}</Text>
            <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.tradeBuy})` }}>
              +{formatUsd(bestPerformer.pnlPercent)}%
            </Text>
          </View>
        ) : (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>—</Text>
        )}
      </View>

      <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
        <View style={[styles.iconWrap, { backgroundColor: `hsl(${theme.colors.tradeSell} / 0.12)` }]}>
          <Ionicons name="warning-outline" size={20} color={`hsl(${theme.colors.tradeSell})`} />
        </View>
        <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Worst Performer</Text>
        {worstPerformer ? (
          <View style={styles.performerRow}>
            <Avatar name={worstPerformer.symbol} size="sm" />
            <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>{worstPerformer.symbol}</Text>
            <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.tradeSell})` }}>
              {formatUsd(worstPerformer.pnlPercent)}%
            </Text>
          </View>
        ) : (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>—</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  card: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 110,
    gap: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '600' },
  value: { fontSize: 18, fontWeight: '800' },
  performerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
