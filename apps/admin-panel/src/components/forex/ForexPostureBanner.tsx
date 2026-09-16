'use client';

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { Activity, Lock, Radio } from 'lucide-react';

/** Demo posture — updated from API in F1; static labels for F0 layout shell */
export function ForexPostureBanner(props: { className?: string }) {
  const pills = [
    { label: 'SIMULATED quotes', variant: 'warning' as const, icon: Radio },
    { label: 'MOCK execution', variant: 'warning' as const, icon: Activity },
    { label: 'REAL_FOREX OFF', variant: 'success' as const, icon: Lock },
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
          <p className="text-xs font-medium uppercase tracking-wider text-violet-300/90">Forex FDM · Control plane</p>
          <p className="text-sm text-admin-muted">
            Isolated ledger &amp; MOCK venue — crypto spot/P2P wallets are out of scope here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <Badge key={p.label} variant={p.variant} className="gap-1 font-normal">
              <p.icon className="h-3 w-3" />
              {p.label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
