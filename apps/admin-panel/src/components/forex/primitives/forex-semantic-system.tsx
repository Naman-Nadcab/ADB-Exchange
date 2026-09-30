'use client';

import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';

/** Exchange admin semantic tones — always prefer these over raw tailwind reds/greens in Forex UI. */
export type ForexSemanticTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

export const FOREX_SEMANTIC: Record<
  ForexSemanticTone,
  { surface: string; border: string; text: string; stripe: string; badge: BadgeVariant }
> = {
  neutral: {
    surface: 'bg-admin-bg/40',
    border: 'border-admin-border/80',
    text: 'text-foreground',
    stripe: 'border-l-admin-border',
    badge: 'default',
  },
  success: {
    surface: 'bg-admin-success/10',
    border: 'border-admin-success/35',
    text: 'text-admin-success',
    stripe: 'border-l-admin-success',
    badge: 'success',
  },
  warning: {
    surface: 'bg-admin-warning/10',
    border: 'border-admin-warning/35',
    text: 'text-admin-warning',
    stripe: 'border-l-admin-warning',
    badge: 'warning',
  },
  danger: {
    surface: 'bg-admin-danger/10',
    border: 'border-admin-danger/35',
    text: 'text-admin-danger',
    stripe: 'border-l-admin-danger',
    badge: 'danger',
  },
  info: {
    surface: 'bg-admin-info/10',
    border: 'border-admin-info/35',
    text: 'text-admin-info',
    stripe: 'border-l-admin-info',
    badge: 'info',
  },
  primary: {
    surface: 'bg-admin-primary/10',
    border: 'border-admin-primary/35',
    text: 'text-admin-primary',
    stripe: 'border-l-admin-primary',
    badge: 'primary',
  },
};

export function forexSemanticToneFromSeverity(severity: 'critical' | 'high' | 'medium' | 'info'): ForexSemanticTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'high') return 'warning';
  if (severity === 'medium') return 'primary';
  return 'info';
}

export function ForexSemanticSurface(props: {
  tone?: ForexSemanticTone;
  children: React.ReactNode;
  className?: string;
  stripe?: boolean;
}) {
  const tone = props.tone ?? 'neutral';
  const s = FOREX_SEMANTIC[tone];
  return (
    <div
      className={cn(
        'rounded-[var(--admin-card-radius)] border p-3',
        s.surface,
        s.border,
        props.stripe && cn('border-l-4', s.stripe),
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

export function ForexSemanticBadge(props: { tone: ForexSemanticTone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant={FOREX_SEMANTIC[props.tone].badge} className={cn('font-normal', props.className)}>
      {props.children}
    </Badge>
  );
}

export function ForexSideSemantic(props: { side: string; className?: string }) {
  const buyish = props.side === 'buy' || props.side === 'long';
  return (
    <ForexSemanticBadge tone={buyish ? 'success' : 'danger'} className={cn('text-[9px] uppercase', props.className)}>
      {props.side}
    </ForexSemanticBadge>
  );
}
