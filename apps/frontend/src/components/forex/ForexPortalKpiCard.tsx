'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fxMoney, fxPlain, fxSigned } from './format';

export type ForexPortalKpiTone = 'brand' | 'neutral' | 'positive' | 'negative' | 'warning';

export function ForexPortalKpiCard(props: {
  label: string;
  value: string | number | null | undefined;
  currency?: string;
  signed?: boolean;
  hint?: string;
  kind?: 'money' | 'plain';
  emphasis: 'primary' | 'secondary';
  /** Color for meaning. Omit to derive it from a signed value, or from emphasis. */
  tone?: ForexPortalKpiTone;
  icon?: LucideIcon;
  className?: string;
}) {
  const signed = props.signed ? fxSigned(props.value) : null;
  const text = signed
    ? signed.text
    : props.kind === 'plain'
      ? props.value == null || props.value === ''
        ? '—'
        : String(props.value)
      : fxMoney(props.value, props.currency ?? 'USD');
  const valueTone = signed?.tone;
  const Icon = props.icon;
  const visualTone: ForexPortalKpiTone =
    props.tone ??
    (valueTone === 'pos' ? 'positive' : valueTone === 'neg' ? 'negative' : props.emphasis === 'primary' ? 'brand' : 'neutral');
  const chip =
    visualTone === 'brand'
      ? 'bg-primary/15 text-primary'
      : visualTone === 'positive'
        ? 'bg-buy/15 text-buy'
        : visualTone === 'negative'
          ? 'bg-sell/15 text-sell'
          : visualTone === 'warning'
            ? 'bg-amber-500/15 text-amber-200'
            : 'bg-muted/50 text-muted-foreground';
  const wash =
    visualTone === 'brand'
      ? 'border-primary/30 bg-gradient-to-br from-card to-primary/[0.14]'
      : visualTone === 'positive'
        ? 'border-buy/35 bg-gradient-to-br from-card to-buy/[0.14]'
        : visualTone === 'negative'
          ? 'border-sell/35 bg-gradient-to-br from-card to-sell/[0.14]'
          : visualTone === 'warning'
            ? 'border-amber-500/35 bg-gradient-to-br from-card to-amber-500/[0.12]'
            : 'border-border/80 bg-card';

  return (
    <div className={cn('forex-overview-kpi relative min-w-0 overflow-hidden border px-3 py-3 sm:px-3.5 sm:py-3.5', wash, props.className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12px] font-medium text-muted-foreground">{props.label}</div>
        {Icon ? (
          <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md', chip)}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          'mt-2 text-[20px] font-semibold tabular-nums leading-tight tracking-tight text-foreground sm:text-[22px]',
          valueTone === 'pos' ? 'text-buy' : valueTone === 'neg' ? 'text-sell' : undefined
        )}
      >
        {text}
      </div>
      {props.hint ? <div className="mt-1 text-[12px] text-muted-foreground">{props.hint}</div> : null}
    </div>
  );
}

export function ForexPortalModuleCard(props: {
  id?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: boolean;
  /** Extra title classes. Merged onto the readable default. */
  titleClassName?: string;
}) {
  return (
    <section
      id={props.id}
      className={cn(
        'eda-card overflow-hidden',
        props.accent && 'border-primary/25',
        props.className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <h2 className={cn('text-[13px] font-semibold tracking-normal text-foreground', props.titleClassName)}>{props.title}</h2>
          {props.subtitle ? <p className="mt-0.5 text-[12px] text-muted-foreground">{props.subtitle}</p> : null}
        </div>
        {props.actions}
      </div>
      <div className="p-4">{props.children}</div>
    </section>
  );
}

export function ForexPortalStatusBadge(props: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
  className?: string;
}) {
  const tone = props.tone ?? 'neutral';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        tone === 'neutral' && 'border-border bg-muted/30 text-muted-foreground',
        tone === 'success' && 'border-buy/40 bg-buy/10 text-buy',
        tone === 'warning' && 'border-amber-500/40 bg-amber-500/10 text-amber-200',
        tone === 'danger' && 'border-sell/40 bg-sell/10 text-sell',
        tone === 'primary' && 'border-primary/40 bg-primary/10 text-primary',
        props.className
      )}
    >
      {props.children}
    </span>
  );
}

export function ledgerStatusTone(status: string | null | undefined): 'neutral' | 'success' | 'warning' | 'danger' {
  const s = String(status ?? '').toUpperCase();
  if (s === 'POSTED' || s === 'SETTLED' || s === 'COMPLETED' || s === 'SUCCESS') return 'success';
  if (s === 'PENDING' || s === 'PROCESSING') return 'warning';
  if (s === 'FAILED' || s === 'REJECTED' || s === 'REVERSED') return 'danger';
  return 'neutral';
}

export function formatLedgerStatusLabel(status: string | null | undefined): string {
  return fxPlain(status);
}
