import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { useTheme, type ThemeTokens } from '@shared/theme';
import type { AllocationSlice } from '@core/domain/wallet/portfolio';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';
import { ExchangeCard } from '@shared/ui';
import { CHART_SVG_COLORS } from '@shared/ui/charts/chartSvgUtils';

type Props = {
  slices: AllocationSlice[];
  totalUsd?: string;
  showBalances?: boolean;
};

const DONUT_COLORS = [
  CHART_SVG_COLORS.buy,
  CHART_SVG_COLORS.brand,
  CHART_SVG_COLORS.sell,
  '#60a5fa',
  '#f59e0b',
  '#a855f7',
  '#64748b',
  '#f97316',
];

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
}

export function AllocationChart({ slices, totalUsd, showBalances = true }: Props) {
  const { theme } = useTheme();
  const top = slices.slice(0, 8);
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  let startAngle = -Math.PI / 2;

  const paths = top.map((item, i) => {
    const sweep = (item.pct / 100) * 2 * Math.PI;
    const endAngle = startAngle + sweep;
    const d = describeArc(cx, cy, r, startAngle, endAngle);
    startAngle = endAngle;
    return { ...item, d, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });

  const centerTotal = parseFloat(totalUsd ?? '0') || top.reduce((s, x) => s + x.usdValue, 0);
  const mask = (v: string) => maskBalance(v, showBalances);

  if (!top.length) {
    return (
      <ExchangeCard variant="terminal" style={styles.wrap}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>PORTFOLIO ALLOCATION</Text>
        <View style={styles.empty}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>No assets yet</Text>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 12, marginTop: 4, fontWeight: '600' }}>
            Make your first deposit
          </Text>
        </View>
      </ExchangeCard>
    );
  }

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>PORTFOLIO ALLOCATION</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>{top.length} assets</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.donutWrap}>
          <Svg width={size} height={size}>
            <G>
              {paths.map((p) => (
                <Path key={p.symbol} d={p.d} fill={p.color} />
              ))}
              <Circle cx={cx} cy={cy} r={r * 0.58} fill={donutCenterFill(theme)} />
            </G>
          </Svg>
          <View style={styles.centerLabel} pointerEvents="none">
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '600' }}>TOTAL</Text>
            <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontSize: 16, fontWeight: '700' }}>
              ${mask(formatUsd(centerTotal))}
            </Text>
          </View>
        </View>
        <View style={styles.legend}>
          {paths.map((p) => (
            <View key={p.symbol} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', flex: 1 }}>
                {p.symbol}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                {p.pct.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ExchangeCard>
  );
}

function donutCenterFill(theme: ThemeTokens) {
  return `hsl(${theme.colors.surfaceMuted})`;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  empty: { alignItems: 'center', paddingVertical: 24 },
  body: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  donutWrap: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center' },
  centerLabel: { position: 'absolute', alignItems: 'center' },
  legend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
