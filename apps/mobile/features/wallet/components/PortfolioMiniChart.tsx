import { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { useTheme } from '@shared/theme';
import { CHART_SVG_COLORS } from '@shared/ui/charts/chartSvgUtils';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';
import type { PortfolioHistoryPeriod } from '../hooks/useWallet';

type Point = { total_usd: number };

type Props = {
  data: Point[];
  period: PortfolioHistoryPeriod;
  showBalances: boolean;
  onRetry?: () => void;
  error?: string | null;
};

export function PortfolioMiniChart({ data, period, showBalances, onRetry, error }: Props) {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.min(screenWidth - 48, 360);
  const height = 120;

  const chart = useMemo(() => {
    if (data.length < 2) return null;
    const vals = data.map((d) => d.total_usd);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const isUp = vals[vals.length - 1] >= vals[0];
    const stroke = isUp ? CHART_SVG_COLORS.buy : CHART_SVG_COLORS.sell;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * chartWidth;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return { x, y };
    });
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `M0,${height} ${pts.map((p) => `L${p.x},${p.y}`).join(' ')} L${chartWidth},${height} Z`;
    return { linePath, areaPath, stroke, first: vals[0], last: vals[vals.length - 1] };
  }, [chartWidth, data, height]);

  const periodLabel = period.toUpperCase();

  if (error) {
    return (
      <View style={[styles.empty, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, textAlign: 'center' }}>
          {error}
        </Text>
        {onRetry ? (
          <Text
            onPress={onRetry}
            style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 12, fontWeight: '600', marginTop: 6 }}
          >
            Retry
          </Text>
        ) : null}
      </View>
    );
  }

  if (!chart) {
    return (
      <View style={[styles.empty, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)` }]}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>Collecting data…</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginTop: 4 }}>
          {periodLabel} range
        </Text>
      </View>
    );
  }

  const mask = (v: number) => maskBalance(formatUsd(v), showBalances);

  return (
    <View>
      <Svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        <Defs>
          <LinearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={chart.stroke} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={chart.stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={chart.areaPath} fill="url(#portfolioFill)" />
        <Path d={chart.linePath} fill="none" stroke={chart.stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={[styles.rangeRow, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
        <View>
          <Text style={[styles.rangeLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Start</Text>
          <Text style={[styles.rangeValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>${mask(chart.first)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.rangeLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>End</Text>
          <Text style={[styles.rangeValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>${mask(chart.last)}</Text>
        </View>
      </View>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginTop: 4 }}>
        Portfolio value · {periodLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 120,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rangeLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  rangeValue: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 2 },
});
