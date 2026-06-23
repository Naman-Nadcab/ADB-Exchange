'use client';

/**
 * Lazy-loaded recharts subtree for the monitoring history chart.
 * Extracted so `recharts` lands in a separate async chunk instead of the
 * monitoring route's First Load JS. Imported via `next/dynamic` (ssr:false).
 */
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

const CHART_GRID = '#1F2A37';
const CHART_TICK = '#9BA7B4';
const CHART_TOOLTIP_BG = '#141A21';
const CHART_TOOLTIP_BORDER = '#2A3441';

export default function LineChartLazy({
  points,
  color,
  unit,
  title,
}: {
  points: Array<{ time: string; value: number }>;
  color: string;
  unit: string;
  title: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: CHART_TICK }} stroke={CHART_GRID} />
        <YAxis tick={{ fontSize: 10, fill: CHART_TICK }} stroke={CHART_GRID} />
        <RechartsTooltip
          contentStyle={{
            fontSize: 11,
            borderRadius: 8,
            border: `1px solid ${CHART_TOOLTIP_BORDER}`,
            background: CHART_TOOLTIP_BG,
            color: '#E6EDF3',
          }}
          formatter={(v: number) => [`${v}${unit ? ' ' + unit : ''}`, title.split(' ')[0]]}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
