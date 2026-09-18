'use client';

import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import type { LucideIcon } from 'lucide-react';

/** Premium work surface — exchange admin-card depth, Forex accent. */
export function ForexWorkspaceSurface(props: { className?: string; children: React.ReactNode; noPadding?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--admin-card-radius)] border border-admin-border bg-[var(--admin-card)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]',
        !props.noPadding && 'p-4',
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function ForexIdentityBlock(props: {
  name: string;
  subtitle?: string | null;
  chips?: Array<{ label: string; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }>;
  avatarSeed?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const initial = (props.name.trim()[0] ?? '?').toUpperCase();
  const hue = props.avatarSeed ? props.avatarSeed.charCodeAt(0) % 360 : 270;
  const Wrapper = props.onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={props.onClick ? 'button' : undefined}
      onClick={props.onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border border-admin-border/60 bg-admin-bg/30 p-2.5 text-left transition-colors',
        props.onClick && 'hover:border-violet-500/40 hover:bg-violet-500/5',
        props.selected && 'border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/30',
      )}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${hue} 65% 28%))` }}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{props.name}</p>
        {props.subtitle ? <p className="truncate text-[11px] text-admin-muted">{props.subtitle}</p> : null}
        {props.chips?.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {props.chips.map((c) => (
              <Badge key={c.label} variant={c.variant ?? 'default'} className="text-[9px] font-normal">
                {c.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </Wrapper>
  );
}

export function ForexExposureBar(props: { long: number; short: number; symbol?: string }) {
  const total = props.long + props.short || 1;
  const longPct = Math.round((props.long / total) * 100);
  return (
    <div className="space-y-1">
      {props.symbol ? <p className="text-xs font-medium text-foreground">{props.symbol}</p> : null}
      <div className="flex h-2 overflow-hidden rounded-full bg-admin-border/80">
        <div className="bg-emerald-500/80 transition-all" style={{ width: `${longPct}%` }} title={`Long ${props.long}`} />
        <div className="bg-red-500/70 transition-all" style={{ width: `${100 - longPct}%` }} title={`Short ${props.short}`} />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-admin-muted">
        <span className="text-emerald-400/90">L {props.long.toFixed(2)}</span>
        <span className="text-red-400/90">S {props.short.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function ForexSpreadBar(props: { spreadPips: string; stale?: boolean }) {
  const pips = Number.parseFloat(props.spreadPips);
  const width = Number.isFinite(pips) ? Math.min(100, Math.max(4, pips * 8)) : 8;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-admin-border">
        <div
          className={cn('h-full rounded-full', props.stale ? 'bg-amber-500' : 'bg-violet-500/80')}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-admin-muted">{props.spreadPips} pips</span>
    </div>
  );
}

export function ForexAttentionCard(props: {
  severity: 'critical' | 'high' | 'medium' | 'info';
  title: string;
  detail?: string | null;
  count?: number | null;
  href: string;
  category: string;
}) {
  const stripe =
    props.severity === 'critical'
      ? 'border-l-red-500'
      : props.severity === 'high'
        ? 'border-l-amber-500'
        : props.severity === 'medium'
          ? 'border-l-violet-500'
          : 'border-l-admin-border';
  return (
    <a
      href={props.href}
      className={cn(
        'group flex items-stretch gap-3 rounded-lg border border-admin-border/70 border-l-4 bg-admin-bg/40 p-3 transition-all hover:border-violet-500/30 hover:bg-violet-500/5',
        stripe,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-admin-muted">{props.category.replace(/_/g, ' ')}</p>
        <p className="text-sm font-medium text-foreground group-hover:text-violet-200">{props.title}</p>
        {props.detail ? <p className="mt-0.5 line-clamp-2 text-xs text-admin-muted">{props.detail}</p> : null}
      </div>
      {props.count != null ? (
        <div className="flex flex-col items-end justify-center">
          <span className="text-lg font-semibold tabular-nums text-foreground">{props.count}</span>
          <span className="text-[10px] text-admin-muted">open</span>
        </div>
      ) : null}
    </a>
  );
}

export function ForexDealerActionBar(props: {
  onAccept: () => void;
  onReject: () => void;
  onAssign: () => void;
  onEscalate: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        type="button"
        disabled={props.disabled}
        onClick={props.onAccept}
        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40"
      >
        Accept
      </button>
      <button
        type="button"
        disabled={props.disabled}
        onClick={props.onReject}
        className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
      >
        Reject
      </button>
      <button
        type="button"
        disabled={props.disabled}
        onClick={props.onAssign}
        className="rounded-lg border border-admin-border bg-admin-bg/60 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground transition hover:border-violet-500/40 disabled:opacity-40"
      >
        Assign
      </button>
      <button
        type="button"
        disabled={props.disabled}
        onClick={props.onEscalate}
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40"
      >
        Escalate
      </button>
    </div>
  );
}

export function ForexFilterBar(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end gap-2 rounded-lg border border-admin-border/60 bg-admin-bg/25 p-3', props.className)}>
      {props.children}
    </div>
  );
}

export function ForexSectionLabel(props: { icon?: LucideIcon; children: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="mb-2 flex items-center gap-2">
      {Icon ? <Icon className="h-3.5 w-3.5 text-violet-400" /> : null}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-admin-muted">{props.children}</span>
    </div>
  );
}
