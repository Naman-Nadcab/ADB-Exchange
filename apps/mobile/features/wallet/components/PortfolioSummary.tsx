import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hsl } from '@shared/theme';
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
    <ExchangeCard elevated style={{ marginBottom: theme.spacing[3.5] }}>
      <View style={styles.titleRow}>
        <Text
          style={[
            theme.typography.labelSm,
            {
              color: hsl(theme.colors.brandPrimary),
              fontFamily: theme.fonts.sansBold,
              letterSpacing: 1.2,
              marginBottom: theme.spacing[1.5],
            },
          ]}
        >
          TOTAL BALANCE
        </Text>
        {onToggleShowBalances ? (
          <Pressable onPress={onToggleShowBalances} hitSlop={10} accessibilityLabel="Toggle balance visibility">
            <Ionicons
              name={showBalances ? 'eye-outline' : 'eye-off-outline'}
              size={theme.sizes.iconSm}
              color={hsl(theme.colors.foregroundSecondary)}
            />
          </Pressable>
        ) : null}
      </View>
      <Text
        style={[
          theme.typography.displayLg,
          {
            color: hsl(theme.colors.foregroundPrimary),
            fontFamily: theme.fonts.sansBold,
            fontVariant: ['tabular-nums'],
            letterSpacing: -0.5,
          },
        ]}
      >
        ${mask(formatUsd(totalUsd))}
      </Text>
      {totalBtc ? (
        <Text style={[theme.typography.bodyMd, { color: hsl(theme.colors.foregroundSecondary), marginTop: theme.spacing[0.5] }]}>
          ≈ {mask(totalBtc)} BTC
        </Text>
      ) : null}

      <View style={[styles.pnlRow, { gap: theme.spacing[3], marginTop: theme.spacing[2] }]}>
        {periodPnl != null ? (
          <View
            style={[
              styles.pnlBadge,
              {
                backgroundColor: `hsl(${pnlColor} / 0.12)`,
                gap: theme.spacing[1],
                paddingHorizontal: theme.spacing[2],
                paddingVertical: theme.spacing[1],
                borderRadius: theme.radius.sm + 2,
              },
            ]}
          >
            <Ionicons
              name={periodPnl.amount >= 0 ? 'arrow-up' : 'arrow-down'}
              size={theme.sizes.iconXs - 4}
              color={hsl(pnlColor)}
            />
            <Text
              style={[
                theme.typography.bodyMd,
                { color: hsl(pnlColor), fontFamily: theme.fonts.sansBold },
              ]}
            >
              {mask(
                `${periodPnl.amount >= 0 ? '+' : ''}${formatUsd(periodPnl.amount)} (${periodPnl.percent >= 0 ? '+' : ''}${periodPnl.percent.toFixed(2)}%)`,
              )}
            </Text>
            <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>
              {chartPeriod} P&L
            </Text>
          </View>
        ) : change24h != null ? (
          <View
            style={[
              styles.pnlBadge,
              {
                backgroundColor: `hsl(${changeColor} / 0.12)`,
                gap: theme.spacing[1],
                paddingHorizontal: theme.spacing[2],
                paddingVertical: theme.spacing[1],
                borderRadius: theme.radius.sm + 2,
              },
            ]}
          >
            <Ionicons
              name={change24h >= 0 ? 'arrow-up' : 'arrow-down'}
              size={theme.sizes.iconXs - 4}
              color={hsl(changeColor)}
            />
            <Text
              style={[
                theme.typography.bodyMd,
                { color: hsl(changeColor), fontFamily: theme.fonts.sansBold },
              ]}
            >
              24h {change24h >= 0 ? '+' : ''}
              {change24h.toFixed(2)}%
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.breakdown,
          {
            gap: theme.spacing[2.5],
            marginTop: theme.spacing[4],
            paddingTop: theme.spacing[3.5],
            borderTopColor: hsl(theme.colors.borderDefault),
          },
        ]}
      >
        <View
          style={[
            styles.col,
            {
              backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.45)`,
              padding: theme.spacing[3],
              borderRadius: theme.radius.md + 2,
              gap: theme.spacing[1],
            },
          ]}
        >
          <Ionicons name="wallet-outline" size={theme.sizes.iconXs} color={hsl(theme.colors.brandPrimary)} />
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: hsl(theme.colors.foregroundSecondary),
                fontFamily: theme.fonts.sansSemiBold,
                letterSpacing: 0.8,
              },
            ]}
          >
            FUNDING
          </Text>
          <Text
            style={[
              theme.typography.headingSm,
              {
                color: hsl(theme.colors.foregroundPrimary),
                fontFamily: theme.fonts.sansBold,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            ${mask(formatUsd(fundingUsd ?? '0'))}
          </Text>
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>
            Deposits & P2P
          </Text>
        </View>
        <View
          style={[
            styles.col,
            {
              backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.45)`,
              padding: theme.spacing[3],
              borderRadius: theme.radius.md + 2,
              gap: theme.spacing[1],
            },
          ]}
        >
          <Ionicons name="trending-up" size={theme.sizes.iconXs} color={hsl(theme.colors.brandPrimary)} />
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: hsl(theme.colors.foregroundSecondary),
                fontFamily: theme.fonts.sansSemiBold,
                letterSpacing: 0.8,
              },
            ]}
          >
            TRADING
          </Text>
          <Text
            style={[
              theme.typography.headingSm,
              {
                color: hsl(theme.colors.foregroundPrimary),
                fontFamily: theme.fonts.sansBold,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            ${mask(formatUsd(tradingUsd ?? '0'))}
          </Text>
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>
            Spot orders & trades
          </Text>
        </View>
      </View>

      <View style={[styles.distRow, { marginTop: theme.spacing[3], gap: theme.spacing[1] }]}>
        <View style={[styles.distTrack, { backgroundColor: hsl(theme.colors.borderDefault) }]}>
          <View style={[styles.distFunding, { width: `${fundingPct}%`, backgroundColor: hsl(theme.colors.brandPrimary) }]} />
          <View
            style={[
              styles.distTrading,
              { width: `${100 - fundingPct}%`, backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.4)` },
            ]}
          />
        </View>
        <View style={styles.distLabels}>
          <Text style={[theme.typography.labelMd, { color: hsl(theme.colors.foregroundSecondary) }]}>
            Funding {fundingPct.toFixed(0)}%
          </Text>
          <Text style={[theme.typography.labelMd, { color: hsl(theme.colors.foregroundSecondary) }]}>
            Trading {(100 - fundingPct).toFixed(0)}%
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.chartSection,
          {
            marginTop: theme.spacing[4],
            paddingTop: theme.spacing[3.5],
            borderTopColor: hsl(theme.colors.borderDefault),
            gap: theme.spacing[2.5],
          },
        ]}
      >
        <View
          style={[
            styles.periodRow,
            {
              backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.5)`,
              borderRadius: theme.radius.md,
              padding: theme.spacing[1],
              gap: theme.spacing[1],
            },
          ]}
        >
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              onPress={() => onChartPeriodChange(p)}
              style={[
                styles.periodBtn,
                {
                  paddingHorizontal: theme.spacing[2.5],
                  paddingVertical: theme.spacing[1.5],
                  borderRadius: theme.radius.sm + 2,
                },
                chartPeriod === p ? { backgroundColor: hsl(theme.colors.brandPrimary) } : null,
              ]}
            >
              <Text
                style={[
                  theme.typography.labelSm,
                  {
                    fontFamily: theme.fonts.sansBold,
                    color:
                      chartPeriod === p
                        ? hsl(theme.colors.brandPrimaryForeground)
                        : hsl(theme.colors.foregroundSecondary),
                  },
                ]}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pnlRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  pnlBadge: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  breakdown: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  col: { flex: 1 },
  distRow: {},
  distTrack: { flexDirection: 'row', height: 6, borderRadius: 999, overflow: 'hidden' },
  distFunding: { height: '100%' },
  distTrading: { height: '100%' },
  distLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chartSection: { borderTopWidth: StyleSheet.hairlineWidth },
  periodRow: { flexDirection: 'row', alignSelf: 'flex-start' },
  periodBtn: {},
});
