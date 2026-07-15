import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { Avatar } from '@shared/ui';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';
import { maxAbsPnl, pnlSign } from '@core/domain/wallet/pnl';
import type { PnlAsset } from '@exchange/mobile-types';

type Props = {
  asset: PnlAsset;
  showBalances: boolean;
  maxPnl?: number;
  onSortPnl?: () => void;
  onSortPercent?: () => void;
  onSortQuantity?: () => void;
  activeSort?: 'pnl' | 'pnlPercent' | 'quantity';
  sortDir?: 'asc' | 'desc';
};

function pnlColor(theme: ReturnType<typeof useTheme>['theme'], value: number): string {
  if (value > 0) return `hsl(${theme.colors.tradeBuy})`;
  if (value < 0) return `hsl(${theme.colors.tradeSell})`;
  return `hsl(${theme.colors.foregroundSecondary})`;
}

export function PnlAssetRow({ asset, showBalances, maxPnl }: Props) {
  const { theme } = useTheme();
  const isPositive = asset.pnl >= 0;
  const barWidth = Math.abs(asset.pnl) / (maxPnl ?? maxAbsPnl([asset]));
  const barWidthPct = `${(barWidth * 100).toFixed(1)}%` as `${number}%`;
  const color = pnlColor(theme, asset.pnl);
  const pctBg = isPositive
    ? `hsl(${theme.colors.tradeBuy} / 0.12)`
    : asset.pnl < 0
      ? `hsl(${theme.colors.tradeSell} / 0.12)`
      : `hsl(${theme.colors.surfaceMuted})`;

  return (
    <View
      style={[
        styles.row,
        { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` },
      ]}
    >
      <View style={styles.assetCol}>
        <Avatar name={asset.symbol} size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.symbol, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{asset.symbol}</Text>
          <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>
            Qty {maskBalance(asset.quantity.toLocaleString('en-US', { maximumFractionDigits: 8 }), showBalances)}
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>P&L</Text>
        <View style={styles.metricValue}>
          {isPositive ? (
            <Ionicons name="trending-up" size={14} color={color} />
          ) : asset.pnl < 0 ? (
            <Ionicons name="trending-down" size={14} color={color} />
          ) : null}
          <Text style={{ color, fontWeight: '700', fontSize: 14 }}>
            {maskBalance(`${pnlSign(asset.pnl)}$${formatUsd(Math.abs(asset.pnl))}`, showBalances)}
          </Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>P&L %</Text>
        <View style={[styles.pctBadge, { backgroundColor: pctBg }]}>
          <Text style={{ color, fontWeight: '700', fontSize: 12 }}>
            {maskBalance(`${pnlSign(asset.pnlPercent)}${formatUsd(asset.pnlPercent)}%`, showBalances)}
          </Text>
        </View>
      </View>

      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: barWidthPct,
              backgroundColor: isPositive ? `hsl(${theme.colors.tradeBuy})` : `hsl(${theme.colors.tradeSell})`,
              opacity: 0.6,
            },
          ]}
        />
      </View>

      <View style={styles.metricRow}>
        <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>Avg Buy</Text>
        <Text style={{ color: `hsl(${theme.colors.tradeBuy})`, fontWeight: '600', fontSize: 12 }}>
          {maskBalance(`$${formatUsd(asset.avgBuyPrice)}`, showBalances)}
        </Text>
      </View>
    </View>
  );
}

export function PnlAssetListHeader({
  onSortPnl,
  onSortPercent,
  onSortQuantity,
  activeSort,
  sortDir,
}: Pick<Props, 'onSortPnl' | 'onSortPercent' | 'onSortQuantity' | 'activeSort' | 'sortDir'>) {
  const { theme } = useTheme();
  const sortMark = (key: NonNullable<Props['activeSort']>) =>
    activeSort === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  return (
    <View style={[styles.header, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
      <Pressable onPress={onSortPnl} style={styles.sortBtn}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})` }}>
          P&L{sortMark('pnl')}
        </Text>
      </Pressable>
      <Pressable onPress={onSortPercent} style={styles.sortBtn}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})` }}>
          P&L %{sortMark('pnlPercent')}
        </Text>
      </Pressable>
      <Pressable onPress={onSortQuantity} style={styles.sortBtn}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})` }}>
          Qty{sortMark('quantity')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  assetCol: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  symbol: { fontWeight: '700', fontSize: 15 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pctBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(120,120,120,0.15)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 8,
  },
  sortBtn: { paddingVertical: 4 },
});
