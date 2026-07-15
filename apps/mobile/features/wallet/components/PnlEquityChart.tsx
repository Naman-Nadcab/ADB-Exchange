import { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@shared/theme';
import { CHART_SVG_COLORS } from '@shared/ui/charts/chartSvgUtils';
import { buildCumulativePnlPoints, formatPnlCompact } from '@core/domain/wallet/pnl';
import type { PnlAsset } from '@exchange/mobile-types';

type Props = {
  assets: PnlAsset[];
  totalPnl: number;
};

export function PnlEquityChart({ assets, totalPnl }: Props) {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.min(screenWidth - 48, 720);
  const height = 200;
  const padX = 40;
  const padY = 24;

  const chart = useMemo(() => {
    const points = buildCumulativePnlPoints(assets);
    if (points.length < 2) return null;

    const min = Math.min(0, ...points);
    const max = Math.max(0, ...points);
    const range = max - min || 1;

    const toX = (i: number) => padX + ((chartWidth - padX * 2) / (points.length - 1)) * i;
    const toY = (v: number) => padY + (height - padY * 2) * (1 - (v - min) / range);

    const linePath = points
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L${toX(points.length - 1).toFixed(1)},${toY(0).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`;

    const isPositive = totalPnl >= 0;
    const stroke = isPositive ? CHART_SVG_COLORS.buy : CHART_SVG_COLORS.sell;
    const zeroY = toY(0);

    const gridValues = [max, max * 0.5, 0, min * 0.5, min].filter(
      (v, _, arr) => arr.indexOf(v) === arr.lastIndexOf(v) || v !== 0,
    );
    const uniqueGrid = Array.from(new Set(gridValues.map((v) => toY(v).toFixed(0)))).map((yStr) => {
      const y = Number(yStr);
      const value = min + (1 - (y - padY) / (height - padY * 2)) * range;
      return { y, value };
    });

    return {
      linePath,
      areaPath,
      stroke,
      zeroY,
      uniqueGrid,
      lastX: toX(points.length - 1),
      lastY: toY(points[points.length - 1] ?? 0),
    };
  }, [assets, chartWidth, totalPnl]);

  if (!chart) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
          Not enough data to render chart
        </Text>
      </View>
    );
  }

  return (
    <Svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
      <Defs>
        <LinearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={chart.stroke} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={chart.stroke} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>

      {chart.uniqueGrid.map((g, i) => (
        <SvgText
          key={`grid-${i}`}
          x={padX - 4}
          y={g.y + 3}
          fontSize={9}
          fill={`hsl(${theme.colors.foregroundSecondary})`}
          textAnchor="end"
        >
          {formatPnlCompact(g.value)}
        </SvgText>
      ))}

      <Line
        x1={padX}
        y1={chart.zeroY}
        x2={chartWidth - padX}
        y2={chart.zeroY}
        stroke={`hsl(${theme.colors.foregroundSecondary})`}
        strokeOpacity={0.15}
      />

      <Path d={chart.areaPath} fill="url(#pnlGrad)" />
      <Path d={chart.linePath} fill="none" stroke={chart.stroke} strokeWidth={2} />
      <Circle cx={chart.lastX} cy={chart.lastY} r={4} fill={chart.stroke} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { height: 200, alignItems: 'center', justifyContent: 'center' },
});
