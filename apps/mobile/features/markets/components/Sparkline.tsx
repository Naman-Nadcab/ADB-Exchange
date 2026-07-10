import { View, StyleSheet } from 'react-native';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
};

/** Minimal sparkline — no chart lib in markets sprint scope. */
export function Sparkline({ data, width = 48, height = 24, color = '#888' }: Props) {
  if (!data.length) return <View style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return { x, y };
  });
  return (
    <View style={[styles.wrap, { width, height }]}>
      {points.slice(1).map((p, i) => {
        const prev = points[i];
        const angle = Math.atan2(p.y - prev.y, p.x - prev.x);
        const len = Math.hypot(p.x - prev.x, p.y - prev.y);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: prev.x,
              top: prev.y,
              width: len,
              height: 2,
              backgroundColor: color,
              transform: [{ rotate: `${angle}rad` }],
            }}
          />
        );
      })}
    </View>
  );
}

export function sparklineFromChange(changePct: number, seed = 1): number[] {
  const base = 50;
  const drift = changePct / 10;
  return Array.from({ length: 8 }, (_, i) => base + drift * i + ((seed * (i + 1)) % 3) - 1);
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
