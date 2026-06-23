'use client';

/**
 * Lazy-loaded recharts subtree for the user-growth area chart.
 * Keeps `recharts` out of the /users/analytics route's First Load JS.
 */
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-admin-border/60 bg-admin-card px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 font-semibold text-admin-text">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="text-admin-muted"><span style={{ color: p.color }} className="font-semibold">{p.name}</span>: {p.value.toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function AreaChartLazy({ growth }: { growth: Array<Record<string, unknown>> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={growth} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="new_users"    stroke="#6366f1" fill="url(#gNew)"    strokeWidth={2} name="New Users" />
        <Area type="monotone" dataKey="active_users" stroke="#22c55e" fill="url(#gActive)" strokeWidth={2} name="Active Users" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
