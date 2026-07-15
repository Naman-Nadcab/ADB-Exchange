import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import { formatUsd, maskBalance, type PeriodPnl } from '@core/domain/wallet/portfolio';
import type { PortfolioHistoryPeriod } from '../hooks/useWallet';
import { PortfolioMiniChart } from './PortfolioMiniChart';

type Props = {
  totalUsd: string;
  totalBtc?: string;
  change24h?: number | null;
  periodPnl?: PeriodPnl | null;
  chartPeriod: PortfolioHistoryPeriod;
  chartData: { total_usd: number }[];
  chartError?: string | null;
  onChartRetry?: () => void;
  onChartPeriodChange: (period: PortfolioHistoryPeriod) => void;
  fundingUsd?: string;
  tradingUsd?: string;
  showBalances: boolean;
  onToggleShowBalances?: () => void;
};

const PERIODS: PortfolioHistoryPeriod[] = ['24h', '7d', '30d', '90d', '1y'];

export function PortfolioSummary({
  totalUsd,
  totalBtc,
  change24h,
  periodPnl,
  chartPeriod,
  chartData,
  chartError,
  onChartRetry,
  onChartPeriodChange,
  fundingUsd,
  tradingUsd,
  showBalances,
  onToggleShowBalances,
}: Props) {
  const { theme } = useTheme();
  const funding = parseFloat(fundingUsd ?? '0') || 0;
  const trading = parseFloat(tradingUsd ?? '0') || 0;
  const total = parseFloat(totalUsd) || funding + trading || 1;
  const fundingPct = total > 0 ? (funding / total) * 100 : 50;

  const pnlColor =
    periodPnl != null && periodPnl.amount >= 0 ? theme.colors.tradeBuy : theme.colors.tradeSell;
  const changeColor =
    change24h != null && change24h >= 0 ? theme.colors.tradeBuy : theme.colors.tradeSell;

  const mask = (v: string) => maskBalance(v, showBalances);

  return (
    <ExchangeCard elevated style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={[styles.eyebrow, { color: `hsl(${theme.colors.brandPrimary})` }]}>TOTAL BALANCE</Text>
        {onToggleShowBalances ? (
          <Pressable onPress={onToggleShowBalances} hitSlop={10} accessibilityLabel="Toggle balance visibility">
            <Ionicons
              name={showBalances ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={`hsl(${theme.colors.foregroundSecondary})`}
            />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.total, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        ${mask(formatUsd(totalUsd))}
      </Text>
      {totalBtc ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, marginTop: 2 }}>
          ≈ {mask(totalBtc)} BTC
        </Text>
      ) : null}

      <View style={styles.pnlRow}>
        {periodPnl != null ? (
          <View style={[styles.pnlBadge, { backgroundColor: `hsl(${pnlColor} / 0.12)` }]}>
            <Ionicons
              name={periodPnl.amount >= 0 ? 'arrow-up' : 'arrow-down'}
              size={12}
              color={`hsl(${pnlColor})`}
            />
            <Text style={{ color: `hsl(${pnlColor})`, fontWeight: '700', fontSize: 13 }}>
              {mask(
                `${periodPnl.amount >= 0 ? '+' : ''}${formatUsd(periodPnl.amount)} (${periodPnl.percent >= 0 ? '+' : ''}${periodPnl.percent.toFixed(2)}%)`,
              )}
            </Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
              {chartPeriod} P&L
            </Text>
          </View>
        ) : change24h != null ? (
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
      </View>

      <View style={[styles.breakdown, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
        <View style={[styles.col, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.45)` }]}>
          <Ionicons name="wallet-outline" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '600', letterSpacing: 0.8 }}>
            FUNDING
          </Text>
          <Text style={[styles.colValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            ${mask(formatUsd(fundingUsd ?? '0'))}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>Deposits & P2P</Text>
        </View>
        <View style={[styles.col, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.45)` }]}>
          <Ionicons name="trending-up" size={16} color={`hsl(${theme.colors.brandPrimary})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '600', letterSpacing: 0.8 }}>
            TRADING
          </Text>
          <Text style={[styles.colValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            ${mask(formatUsd(tradingUsd ?? '0'))}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>Spot orders & trades</Text>
        </View>
      </View>

      <View style={styles.distRow}>
        <View style={[styles.distTrack, { backgroundColor: `hsl(${theme.colors.borderDefault})` }]}>
          <View style={[styles.distFunding, { width: `${fundingPct}%`, backgroundColor: `hsl(${theme.colors.brandPrimary})` }]} />
          <View style={[styles.distTrading, { width: `${100 - fundingPct}%`, backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.4)` }]} />
        </View>
        <View style={styles.distLabels}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
            Funding {fundingPct.toFixed(0)}%
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
            Trading {(100 - fundingPct).toFixed(0)}%
          </Text>
        </View>
      </View>

      <View style={[styles.chartSection, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
        <View style={[styles.periodRow, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.5)` }]}>
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              onPress={() => onChartPeriodChange(p)}
              style={[
                styles.periodBtn,
                chartPeriod === p ? { backgroundColor: `hsl(${theme.colors.brandPrimary})` } : null,
              ]}
            >
              <Text
                style={{
                  color:
                    chartPeriod === p
                      ? `hsl(${theme.colors.brandPrimaryForeground})`
                      : `hsl(${theme.colors.foregroundSecondary})`,
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {p}
              </Text>
            </Pressable>
          ))}
        </View>
        <PortfolioMiniChart
          data={chartData}
          period={chartPeriod}
          showBalances={showBalances}
          error={chartError}
          onRetry={onChartRetry}
        />
      </View>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
    flexWrap: 'wrap',
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
  distRow: { marginTop: 12, gap: 4 },
  distTrack: { flexDirection: 'row', height: 6, borderRadius: 999, overflow: 'hidden' },
  distFunding: { height: '100%' },
  distTrading: { height: '100%' },
  distLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chartSection: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  periodRow: { flexDirection: 'row', borderRadius: 8, padding: 4, gap: 4, alignSelf: 'flex-start' },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
});
