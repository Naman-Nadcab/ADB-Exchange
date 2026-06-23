'use client';

/**
 * Lazy-loaded recharts subtree for the liquidity history chart.
 * Keeps `recharts` out of the liquidity route's First Load JS.
 */
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-admin-border bg-admin-card px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-admin-text mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-admin-muted">
          {p.name}: <span className="text-indigo-400 font-mono">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function LineChartLazy({ historyRows }: { historyRows: Array<Record<string, unknown>> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={historyRows} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<DarkTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          name="Score"
          stroke="#6366F1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#6366F1', stroke: '#fff', strokeWidth: 1.5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
