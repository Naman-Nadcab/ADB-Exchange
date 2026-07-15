import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@shared/theme';
import { buildDepthSeries, formatDepthQty } from '@core/domain/trade/depthChart';
import { CHART_SVG_COLORS, hasPolylinePoints } from './chartSvgUtils';
import type { OrderbookLevel } from '@exchange/mobile-types';

type Props = {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  height?: number;
};

export function DepthChart({ bids, asks, height = 160 }: Props) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const viewBoxHeight = 120;
  const series = useMemo(() => buildDepthSeries(bids, asks, viewBoxHeight), [bids, asks]);
  const svgHeight = Math.max(80, height - 36);

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel="Orderbook depth chart"
    >
      <View style={styles.header}>
        <Text style={[styles.legend, { color: `hsl(${theme.colors.tradeBuy})` }]}>● Bid depth</Text>
        <Text style={[styles.mid, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Mid {series.mid > 0 ? formatDepthQty(series.mid) : '—'}
          {series.spreadPct > 0 ? ` · Spread ${series.spreadPct.toFixed(3)}%` : ''}
        </Text>
        <Text style={[styles.legend, { color: `hsl(${theme.colors.tradeSell})` }]}>Ask depth ●</Text>
      </View>
      {!series.hasDepth ? (
        <View style={[styles.empty, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
            Waiting for orderbook depth…
          </Text>
        </View>
      ) : width > 0 ? (
        <Svg width={width} height={svgHeight} viewBox={`0 0 100 ${viewBoxHeight}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="depthBid" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={CHART_SVG_COLORS.buy} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={CHART_SVG_COLORS.buy} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="depthAsk" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={CHART_SVG_COLORS.sell} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={CHART_SVG_COLORS.sell} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Line x1="0" x2="100" y1={viewBoxHeight - 16} y2={viewBoxHeight - 16} stroke={CHART_SVG_COLORS.grid} strokeOpacity={0.35} />
          <Line x1="50" x2="50" y1="6" y2={viewBoxHeight - 16} stroke={CHART_SVG_COLORS.grid} strokeDasharray="1.5 1.5" strokeOpacity={0.35} />
          <Polygon points={series.bidPath} fill="url(#depthBid)" />
          <Polygon points={series.askPath} fill="url(#depthAsk)" />
          {hasPolylinePoints(series.bidPoints.map((p) => `${p.x},${p.y}`).join(' ')) ? (
            <Polyline
              points={series.bidPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={CHART_SVG_COLORS.buy}
              strokeWidth="0.9"
            />
          ) : null}
          {hasPolylinePoints(series.askPoints.map((p) => `${p.x},${p.y}`).join(' ')) ? (
            <Polyline
              points={series.askPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={CHART_SVG_COLORS.sell}
              strokeWidth="0.9"
            />
          ) : null}
          <SvgText x="1" y="10" fontSize="3.2" fill={CHART_SVG_COLORS.grid}>
            Cum Qty {formatDepthQty(series.maxCum)}
          </SvgText>
          <SvgText x="1" y={viewBoxHeight - 18} fontSize="3.2" fill={CHART_SVG_COLORS.grid}>
            Bid {formatDepthQty(series.bestBid)}
          </SvgText>
          <SvgText x="99" y={viewBoxHeight - 18} fontSize="3.2" fill={CHART_SVG_COLORS.grid} textAnchor="end">
            Ask {formatDepthQty(series.bestAsk)}
          </SvgText>
        </Svg>
      ) : (
        <View style={[styles.empty, { borderColor: `hsl(${theme.colors.borderDefault})` }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginVertical: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 2 },
  legend: { fontSize: 11, fontWeight: '600' },
  mid: { fontSize: 11, textAlign: 'center', flex: 1 },
  empty: { flex: 1, minHeight: 120, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
