'use client';

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

/**
 * Premium workspace chrome — native to exchange admin tokens (violet accent, admin-card depth).
 */
export function ForexWorkspaceHeader(props: {
  title: string;
  purpose: string;
  dataSource: string;
  posture?: 'MOCK' | 'SIMULATED' | 'LIVE' | 'NOT_CONFIGURED';
  kpis?: Array<{ label: string; value: string; tone?: 'default' | 'warning' | 'danger' | 'success' }>;
  compact?: boolean;
}) {
  const posture = props.posture ?? 'MOCK';
  const postureVariant =
    posture === 'LIVE' ? 'danger' : posture === 'NOT_CONFIGURED' ? 'default' : 'warning';

  return (
    <div
      className={cn(
        'forex-workspace-header mb-4 overflow-hidden rounded-[var(--admin-card-radius)] border border-admin-border',
        'bg-gradient-to-br from-violet-500/[0.08] via-[var(--admin-card)] to-[var(--admin-card)]',
        'shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]',
      )}
    >
      <div className="border-b border-admin-border/80 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-300/90">
              Forex operations workspace
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{props.title}</h2>
            {!props.compact ? <p className="mt-1 max-w-3xl text-sm leading-snug text-admin-muted">{props.purpose}</p> : null}
          </div>
          <Badge variant={postureVariant} className="shrink-0 font-normal">
            {posture}
          </Badge>
        </div>
        <p className="mt-2 text-[11px] text-admin-muted">
          Source: <span className="font-mono text-[10px] text-foreground/80">{props.dataSource}</span>
        </p>
      </div>
      {props.kpis?.length ? (
        <dl className="grid gap-px bg-admin-border/50 sm:grid-cols-2 lg:grid-cols-4">
          {props.kpis.map((k) => (
            <div key={k.label} className="bg-[var(--admin-card)] px-4 py-3">
              <dt className="text-[10px] uppercase tracking-wide text-admin-muted">{k.label}</dt>
              <dd
                className={cn(
                  'mt-0.5 text-base font-semibold tabular-nums tracking-tight',
                  k.tone === 'danger' && 'text-admin-danger',
                  k.tone === 'warning' && 'text-admin-warning',
                  k.tone === 'success' && 'text-admin-success',
                )}
              >
                {k.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
