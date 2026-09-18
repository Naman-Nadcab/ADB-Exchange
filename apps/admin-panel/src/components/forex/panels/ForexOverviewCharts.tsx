'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexEmptyState } from '@/components/forex/primitives/ForexEmptyState';
import { BarChart3 } from 'lucide-react';

const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444'];

export function ForexOverviewCharts(props: {
  openOrders: number;
  openPositions: number;
  ledgerAccounts: number;
  filled24h?: number;
  failed24h?: number;
  killSwitch?: boolean;
  economicReady?: boolean;
}) {
  const exposure = [
    { name: 'Open orders', value: props.openOrders },
    { name: 'Open positions', value: props.openPositions },
    { name: 'Ledger accounts', value: props.ledgerAccounts },
  ];

  const hasExposure = exposure.some((d) => d.value > 0);
  const exec = [
    { name: 'Filled (24h)', value: props.filled24h ?? 0 },
    { name: 'Failed (24h)', value: props.failed24h ?? 0 },
  ];
  const hasExec = exec.some((d) => d.value > 0);

  const posture = [
    { name: 'Markets ready', value: props.economicReady ? 1 : 0, fill: props.economicReady ? '#10B981' : '#EF4444' },
    { name: 'Kill switch off', value: props.killSwitch ? 0 : 1, fill: props.killSwitch ? '#EF4444' : '#10B981' },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ForexPanelShell title="Book exposure" description="Live counts from admin overview">
        {hasExposure ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={exposure} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2A37" />
                <XAxis dataKey="name" tick={{ fill: '#9BA7B4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#9BA7B4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#141A21', border: '1px solid #1F2A37', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#E6EDF3' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {exposure.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ForexEmptyState
            title="No open exposure"
            description="Open orders and positions are zero — mock venue may be idle."
            icon={BarChart3}
            className="py-8"
          />
        )}
      </ForexPanelShell>

      <ForexPanelShell title="Execution & posture" description="24h fill summary and platform gates">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-40">
            {hasExec ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exec} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#9BA7B4', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#141A21', border: '1px solid #1F2A37', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ForexEmptyState title="No fills in 24h" description="Execution chart populates when the mock venue records activity." className="py-4" />
            )}
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={posture} dataKey="value" nameKey="name" innerRadius={36} outerRadius={56} paddingAngle={4}>
                  {posture.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#141A21', border: '1px solid #1F2A37', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-1 space-y-0.5 text-[10px] text-admin-muted">
              <li>{props.economicReady ? 'Markets ready' : 'Markets blocked'}</li>
              <li>{props.killSwitch ? 'Kill switch ON' : 'Kill switch off'}</li>
            </ul>
          </div>
        </div>
      </ForexPanelShell>
    </div>
  );
}
