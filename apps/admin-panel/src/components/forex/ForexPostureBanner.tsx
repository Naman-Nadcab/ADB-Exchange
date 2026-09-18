'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminOverview } from '@/lib/admin/forex-api';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { deriveForexVenueMode } from '@/lib/admin/forex-posture';
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
  const venue = deriveForexVenueMode(posture);
  const venueVariant =
    venue.mode === 'LIVE' ? ('danger' as const) : venue.mode === 'SIMULATED' ? ('warning' as const) : ('info' as const);

  const pills = [
    {
      label: posture ? `${posture.source} quotes` : 'Simulated quotes',
      variant: 'warning' as const,
      icon: Radio,
    },
    {
      label: posture ? `${posture.executionMode} venue` : 'Mock venue',
      variant: 'warning' as const,
      icon: Activity,
    },
    {
      label: posture?.realForex ? 'Live money path armed' : 'Live money path blocked',
      variant: posture?.realForex ? ('danger' as const) : ('success' as const),
      icon: Lock,
    },
    {
      label: ready ? 'Markets ready' : 'Markets not ready',
      variant: ready ? ('success' as const) : ('danger' as const),
      icon: AlertTriangle,
    },
  ];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-violet-500/25 bg-gradient-to-r from-violet-950/70 via-admin-card to-indigo-950/50 px-4 py-3',
        props.className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(139,92,246,0.12),_transparent_55%)]" />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Forex Operations</p>
            {!isLoading && !isError ? (
              <Badge variant={venueVariant} className="font-semibold tracking-wide">
                {venue.mode}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-admin-muted">
            {isLoading
              ? 'Loading venue posture…'
              : isError
                ? 'Could not load posture — check session and API connectivity'
                : `${venue.description} · Isolated ledger · crypto wallets excluded`}
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
              Kill switch active
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}
