import { View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { Candle } from '@exchange/mobile-types';

const INTERVALS = [
  { label: '1m', sec: 60 },
  { label: '5m', sec: 300 },
  { label: '15m', sec: 900 },
  { label: '1h', sec: 3600 },
  { label: '4h', sec: 14400 },
  { label: '1d', sec: 86400 },
];

type Props = {
  candles: Candle[];
  height?: number;
};

/** Native candle chart (ADR-010 — no TradingView/WebView). */
export function CandleChart({ candles, height = 160 }: Props) {
  const { theme } = useTheme();
  if (!candles.length) return <View style={[styles.empty, { height }]} />;

  const slice = candles.slice(-60);
  const highs = slice.map((c) => parseFloat(c.high));
  const lows = slice.map((c) => parseFloat(c.low));
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;
  const barW = Math.max(2, Math.floor(300 / slice.length));

  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel="Price chart">
      <View style={styles.bars}>
        {slice.map((c, i) => {
          const open = parseFloat(c.open);
          const close = parseFloat(c.close);
          const up = close >= open;
          const top = height - ((parseFloat(c.high) - min) / range) * height;
          const bottom = height - ((parseFloat(c.low) - min) / range) * height;
          const bodyTop = height - ((Math.max(open, close) - min) / range) * height;
          const bodyH = Math.max(1, Math.abs(close - open) / range * height);
          const color = up ? theme.colors.tradeBuy : theme.colors.tradeSell;
          return (
            <View key={`${c.time}-${i}`} style={{ width: barW, height, marginRight: 1 }}>
              <View
                style={{
                  position: 'absolute',
                  left: barW / 2,
                  top,
                  width: 1,
                  height: bottom - top,
                  backgroundColor: `hsl(${color})`,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: bodyTop,
                  width: barW,
                  height: bodyH,
                  backgroundColor: `hsl(${color})`,
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export { INTERVALS };

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', marginVertical: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  empty: { backgroundColor: 'transparent' },
});
