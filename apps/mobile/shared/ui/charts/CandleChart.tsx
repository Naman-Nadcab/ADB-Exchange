import { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@shared/theme';
import type { Candle } from '@exchange/mobile-types';
import type { ChartStudiesState } from '@core/domain/trade/indicators';
import { resolveOverlayStudy, computeRsi, computeVolumeSma, computeEma } from '@core/domain/trade/indicators';
import { CHART_SVG_COLORS, hasPolylinePoints } from './chartSvgUtils';

export const CHART_INTERVALS = [
  { label: '1m', sec: 60 },
  { label: '5m', sec: 300 },
  { label: '15m', sec: 900 },
  { label: '30m', sec: 1800 },
  { label: '1h', sec: 3600 },
  { label: '4h', sec: 14400 },
  { label: '1d', sec: 86400 },
] as const;

export type ChartTradeMarker = {
  time: number;
  price: number;
  side: 'buy' | 'sell';
};

type Props = {
  candles: Candle[];
  height?: number;
  studies?: ChartStudiesState;
  tradeMarkers?: ChartTradeMarker[];
  livePrice?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function mapSeries(
  points: { time: number; value: number }[],
  slice: Candle[],
  min: number,
  max: number,
  width: number,
  height: number,
  barW: number,
): string {
  const timeToIndex = new Map(slice.map((c, i) => [c.time, i]));
  const range = max - min || 1;
  const coords: string[] = [];
  for (const pt of points) {
    const idx = timeToIndex.get(pt.time);
    if (idx === undefined) continue;
    const x = idx * barW + barW / 2;
    const y = height - ((pt.value - min) / range) * height;
    coords.push(`${x},${y}`);
  }
  return coords.join(' ');
}

/** Native candle chart with pan/zoom, crosshair, trade markers, and indicator overlays. */
export function CandleChart({ candles, height = 160, studies, tradeMarkers = [], livePrice }: Props) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const [barCount, setBarCount] = useState(60);
  const [windowOffset, setWindowOffset] = useState(0);
  const [crossIdx, setCrossIdx] = useState<number | null>(null);
  const rsiEnabled = studies?.rsi ?? false;
  const volumeSmaEnabled = studies?.volumeSma ?? false;
  const overlayStudy = studies?.overlay ?? 'none';

  const layout = useMemo(() => {
    const rsiH = rsiEnabled ? 56 : 0;
    const volH = Math.max(24, Math.floor((height - rsiH) * 0.2));
    const priceH = height - volH - rsiH - (rsiEnabled ? 4 : 0) - 4;
    return { priceH, volH, rsiH };
  }, [height, rsiEnabled]);

  const end = candles.length - windowOffset;
  const start = Math.max(0, end - barCount);
  const slice = candles.slice(start, end);

  const panGesture = Gesture.Pan().onUpdate((e) => {
    const delta = Math.round(-e.translationX / Math.max(3, Math.floor(width / barCount)));
    setWindowOffset((prev) => clamp(prev + delta, 0, Math.max(0, candles.length - barCount)));
  });

  const pinchGesture = Gesture.Pinch().onUpdate((e) => {
    setBarCount((prev) => clamp(Math.round(prev / e.scale), 25, 120));
  });

  const chartGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const handleCrosshair = useCallback(
    (x: number) => {
      if (width <= 0 || !slice.length) return;
      const barW = Math.max(2, Math.floor(width / slice.length));
      const idx = clamp(Math.floor(x / barW), 0, slice.length - 1);
      setCrossIdx(idx);
    },
    [width, slice.length],
  );

  if (!candles.length) {
    return (
      <View
        style={[styles.empty, { height }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityLabel="Price chart empty"
      />
    );
  }

  const highs = slice.map((c) => parseFloat(c.high));
  const lows = slice.map((c) => parseFloat(c.low));
  let max = Math.max(...highs);
  let min = Math.min(...lows);
  if (livePrice != null && Number.isFinite(livePrice)) {
    max = Math.max(max, livePrice);
    min = Math.min(min, livePrice);
  }

  const overlay = overlayStudy !== 'none' ? resolveOverlayStudy(overlayStudy, slice) : null;
  if (overlay?.kind === 'line') {
    for (const p of overlay.points) {
      max = Math.max(max, p.value);
      min = Math.min(min, p.value);
    }
  } else if (overlay?.kind === 'bb') {
    for (const p of [...overlay.upper, ...overlay.lower]) {
      max = Math.max(max, p.value);
      min = Math.min(min, p.value);
    }
  }

  const range = max - min || 1;
  const chartWidth = width > 0 ? width : 300;
  const barW = Math.max(2, Math.floor(chartWidth / slice.length));
  const volMax = Math.max(...slice.map((c) => parseFloat(c.volume) || 0), 1);
  const rsiPoints = rsiEnabled ? computeRsi(slice, 14) : [];
  const volSmaPoints = volumeSmaEnabled ? computeVolumeSma(slice, 9) : [];

  const overlayLine =
    overlay?.kind === 'line' ? mapSeries(overlay.points, slice, min, max, chartWidth, layout.priceH, barW) : '';
  const bbMid =
    overlay?.kind === 'bb' ? mapSeries(overlay.mid, slice, min, max, chartWidth, layout.priceH, barW) : '';
  const bbUpper =
    overlay?.kind === 'bb' ? mapSeries(overlay.upper, slice, min, max, chartWidth, layout.priceH, barW) : '';
  const bbLower =
    overlay?.kind === 'bb' ? mapSeries(overlay.lower, slice, min, max, chartWidth, layout.priceH, barW) : '';
  const rsiLine = rsiEnabled ? mapSeries(rsiPoints, slice, 0, 100, chartWidth, layout.rsiH, barW) : '';
  const volSmaLine = volumeSmaEnabled ? mapSeries(volSmaPoints, slice, 0, volMax, chartWidth, layout.volH, barW) : '';

  const emaStackLines = [
    studies?.ema7 ? mapSeries(computeEma(slice, 7), slice, min, max, chartWidth, layout.priceH, barW) : '',
    studies?.ema20 ? mapSeries(computeEma(slice, 20), slice, min, max, chartWidth, layout.priceH, barW) : '',
    studies?.ema50 ? mapSeries(computeEma(slice, 50), slice, min, max, chartWidth, layout.priceH, barW) : '',
    studies?.ema200 ? mapSeries(computeEma(slice, 200), slice, min, max, chartWidth, layout.priceH, barW) : '',
  ].filter(hasPolylinePoints);

  const crossCandle = crossIdx != null ? slice[crossIdx] : null;
  const crossX = crossIdx != null ? crossIdx * barW + barW / 2 : 0;

  const markerDots = tradeMarkers
    .map((m) => {
      const idx = slice.findIndex((c) => c.time === m.time);
      if (idx < 0) return null;
      const x = idx * barW + barW / 2;
      const y = layout.priceH - ((m.price - min) / range) * layout.priceH;
      return { x, y, side: m.side, key: `${m.time}-${m.price}` };
    })
    .filter(Boolean) as { x: number; y: number; side: 'buy' | 'sell'; key: string }[];

  const liveY =
    livePrice != null && Number.isFinite(livePrice)
      ? layout.priceH - ((livePrice - min) / range) * layout.priceH
      : null;

  return (
    <View style={[styles.wrap, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel="Price chart">
      {crossCandle ? (
        <Text style={[styles.legend, { color: `hsl(${theme.colors.foregroundSecondary})` }]} numberOfLines={1}>
          O {crossCandle.open} H {crossCandle.high} L {crossCandle.low} C {crossCandle.close}
        </Text>
      ) : (
        <Text style={[styles.legend, { color: `hsl(${theme.colors.foregroundSecondary})` }]} numberOfLines={1}>
          Pinch to zoom · drag to pan
        </Text>
      )}

      <GestureDetector gesture={chartGesture}>
        <Pressable
          onPressIn={(e) => handleCrosshair(e.nativeEvent.locationX)}
          onTouchMove={(e) => handleCrosshair(e.nativeEvent.locationX)}
          style={{ height: layout.priceH, position: 'relative' }}
        >
          <View style={[styles.bars, { height: layout.priceH }]}>
            {slice.map((c, i) => {
              const open = parseFloat(c.open);
              const close = parseFloat(c.close);
              const up = close >= open;
              const top = layout.priceH - ((parseFloat(c.high) - min) / range) * layout.priceH;
              const bottom = layout.priceH - ((parseFloat(c.low) - min) / range) * layout.priceH;
              const bodyTop = layout.priceH - ((Math.max(open, close) - min) / range) * layout.priceH;
              const bodyH = Math.max(1, (Math.abs(close - open) / range) * layout.priceH);
              const color = up ? theme.colors.tradeBuy : theme.colors.tradeSell;
              return (
                <View key={`${c.time}-${i}`} style={{ width: barW, height: layout.priceH, marginRight: 1 }}>
                  <View style={{ position: 'absolute', left: barW / 2, top, width: 1, height: bottom - top, backgroundColor: `hsl(${color})` }} />
                  <View style={{ position: 'absolute', left: 0, top: bodyTop, width: barW, height: bodyH, backgroundColor: `hsl(${color})` }} />
                </View>
              );
            })}
          </View>
          {width > 0 ? (
            <Svg style={StyleSheet.absoluteFill} width={chartWidth} height={layout.priceH}>
              {hasPolylinePoints(overlayLine) ? (
                <Polyline points={overlayLine} fill="none" stroke={CHART_SVG_COLORS.brand} strokeWidth="1.5" />
              ) : null}
              {emaStackLines.map((pts, i) => (
                <Polyline key={`ema-${i}`} points={pts} fill="none" stroke={CHART_SVG_COLORS.bbMid} strokeWidth="1.2" />
              ))}
              {overlay?.kind === 'bb' ? (
                <>
                  {hasPolylinePoints(bbUpper) ? (
                    <Polyline points={bbUpper} fill="none" stroke={CHART_SVG_COLORS.bbBand} strokeWidth="1" strokeDasharray="3 2" />
                  ) : null}
                  {hasPolylinePoints(bbMid) ? (
                    <Polyline points={bbMid} fill="none" stroke={CHART_SVG_COLORS.bbMid} strokeWidth="1.2" />
                  ) : null}
                  {hasPolylinePoints(bbLower) ? (
                    <Polyline points={bbLower} fill="none" stroke={CHART_SVG_COLORS.bbBand} strokeWidth="1" strokeDasharray="3 2" />
                  ) : null}
                </>
              ) : null}
              {liveY != null ? (
                <Line x1="0" x2={chartWidth} y1={liveY} y2={liveY} stroke={CHART_SVG_COLORS.brand} strokeDasharray="4 3" strokeWidth="1" />
              ) : null}
              {crossIdx != null ? (
                <Line x1={crossX} x2={crossX} y1="0" y2={layout.priceH} stroke={CHART_SVG_COLORS.grid} strokeWidth="1" strokeOpacity={0.8} />
              ) : null}
              {markerDots.map((m) => (
                <Circle
                  key={m.key}
                  cx={m.x}
                  cy={m.y}
                  r="3"
                  fill={m.side === 'buy' ? CHART_SVG_COLORS.buy : CHART_SVG_COLORS.sell}
                />
              ))}
            </Svg>
          ) : null}
        </Pressable>
      </GestureDetector>

      {layout.volH > 8 ? (
        <View style={{ height: layout.volH, marginTop: 4, position: 'relative' }}>
          <View style={[styles.volumeRow, { height: layout.volH }]}>
            {slice.map((c, i) => {
              const up = parseFloat(c.close) >= parseFloat(c.open);
              const vol = parseFloat(c.volume) || 0;
              const barH = Math.max(1, (vol / volMax) * layout.volH);
              const color = up ? theme.colors.tradeBuy : theme.colors.tradeSell;
              return (
                <View key={`v-${c.time}-${i}`} style={{ width: barW, height: layout.volH, marginRight: 1, justifyContent: 'flex-end' }}>
                  <View style={{ height: barH, width: barW, backgroundColor: `hsl(${color} / 0.45)` }} />
                </View>
              );
            })}
          </View>
          {width > 0 && hasPolylinePoints(volSmaLine) ? (
            <Svg style={StyleSheet.absoluteFill} width={chartWidth} height={layout.volH}>
              <Polyline points={volSmaLine} fill="none" stroke={CHART_SVG_COLORS.brand} strokeWidth="1.2" />
            </Svg>
          ) : null}
        </View>
      ) : null}

      {rsiEnabled && layout.rsiH > 0 ? (
        <View style={{ height: layout.rsiH, marginTop: 4, position: 'relative' }}>
          <Svg width={chartWidth} height={layout.rsiH}>
            <Line x1="0" x2={chartWidth} y1={layout.rsiH * 0.3} y2={layout.rsiH * 0.3} stroke={CHART_SVG_COLORS.grid} strokeDasharray="2 2" strokeOpacity={0.5} />
            <Line x1="0" x2={chartWidth} y1={layout.rsiH * 0.7} y2={layout.rsiH * 0.7} stroke={CHART_SVG_COLORS.grid} strokeDasharray="2 2" strokeOpacity={0.5} />
            {hasPolylinePoints(rsiLine) ? (
              <Polyline points={rsiLine} fill="none" stroke={CHART_SVG_COLORS.rsi} strokeWidth="1.5" />
            ) : null}
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', marginVertical: 8, width: '100%' },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  volumeRow: { flexDirection: 'row', alignItems: 'flex-end' },
  empty: { backgroundColor: 'transparent', width: '100%' },
  legend: { fontSize: 10, marginBottom: 4, fontFamily: 'IBMPlexMono_400Regular' },
});
