/** Solid colors for react-native-svg (hsl/alpha strings are unreliable in RNSVG). */
export const CHART_SVG_COLORS = {
  buy: '#22c55e',
  sell: '#ef4444',
  brand: '#eab308',
  bbMid: '#60a5fa',
  bbBand: '#94a3b8',
  rsi: '#a855f7',
  grid: '#64748b',
} as const;

export function hasPolylinePoints(points: string): boolean {
  return points.trim().length > 0;
}
