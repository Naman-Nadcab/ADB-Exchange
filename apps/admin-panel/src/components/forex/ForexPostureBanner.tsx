'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminOverview } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { Activity, Lock, Radio, AlertTriangle } from 'lucide-react';

export function ForexPostureBanner(props: { className?: string }) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const { data, isError, isLoading } = useQuery({
    queryKey: ['admin', 'forex', 'overview-banner', token],
    queryFn: async () => {
      const res = await getForexAdminOverview(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Overview failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const posture = data?.posture;
  const ready = data?.readiness?.economicReady;

  const pills = [
    {
      label: posture ? `${posture.source} quotes` : 'SIMULATED quotes',
      variant: 'warning' as const,
      icon: Radio,
    },
    {
      label: posture ? `${posture.executionMode} execution` : 'MOCK execution',
      variant: 'warning' as const,
      icon: Activity,
    },
    {
      label: posture?.realForex ? 'REAL_FOREX ON' : 'REAL_FOREX OFF',
      variant: posture?.realForex ? ('danger' as const) : ('success' as const),
      icon: Lock,
    },
    {
      label: ready ? 'Economic READY' : 'Economic NOT READY',
      variant: ready ? ('success' as const) : ('danger' as const),
      icon: AlertTriangle,
    },
  ];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-950/80 via-admin-card to-indigo-950/60 px-4 py-3',
        props.className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(139,92,246,0.15),_transparent_55%)]" />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-violet-300/90">Forex FDM · F0–F6 live · MOCK / SIMULATED only</p>
          <p className="text-sm text-admin-muted">
            {isLoading
              ? 'Loading posture from admin API…'
              : isError
                ? 'Could not load live posture — check admin token and backend /admin/forex/overview'
                : 'Isolated ledger & MOCK venue — crypto wallets out of scope.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <Badge key={p.label} variant={p.variant} className="gap-1 font-normal">
              <p.icon className="h-3 w-3" />
              {p.label}
            </Badge>
          ))}
          {posture?.killSwitch ? (
            <Badge variant="danger" className="font-normal">
              KILL SWITCH ON
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}
