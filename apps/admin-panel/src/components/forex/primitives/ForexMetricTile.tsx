'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export function ForexMetricTile(props: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const Icon = props.icon;
  const tone = props.tone ?? 'default';
  const toneBorder =
    tone === 'success'
      ? 'border-emerald-500/25'
      : tone === 'warning'
        ? 'border-amber-500/25'
        : tone === 'danger'
          ? 'border-red-500/25'
          : 'border-admin-border';

  return (
    <div
      className={cn(
        'rounded-ds-md border bg-admin-card/90 p-4 transition-colors hover:border-[#2A3441]',
        toneBorder,
        props.className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-admin-muted">{props.label}</p>
        {Icon ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-admin-muted">
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
      <p className="text-xl font-bold tabular-nums text-admin-text">{props.value}</p>
      {props.hint ? <p className="mt-1 text-xs text-admin-muted">{props.hint}</p> : null}
    </div>
  );
}
