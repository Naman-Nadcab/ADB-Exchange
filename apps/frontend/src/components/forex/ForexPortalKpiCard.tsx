'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fxMoney, fxPlain, fxSigned } from './format';

export function ForexPortalKpiCard(props: {
  label: string;
  value: string | number | null | undefined;
  currency?: string;
  signed?: boolean;
  hint?: string;
  kind?: 'money' | 'plain';
  emphasis: 'primary' | 'secondary';
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
  const tone = signed?.tone;
  const primary = props.emphasis === 'primary';
  const Icon = props.icon;

  return (
    <div
      className={cn(
        'relative min-w-0 overflow-hidden rounded border px-2.5 py-2 sm:px-3 sm:py-2.5',
        primary
          ? 'border-primary/30 bg-gradient-to-br from-card via-card to-primary/[0.06] shadow-sm'
          : 'border-border/80 bg-card/75',
        props.className
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            'pointer-events-none absolute right-2 top-2 opacity-[0.14]',
            primary ? 'h-5 w-5 text-primary' : 'h-4 w-4 text-muted-foreground'
          )}
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          'pr-6 uppercase tracking-[0.1em] text-muted-foreground',
          primary ? 'text-[10px] font-medium' : 'text-[9px]'
        )}
      >
        {props.label}
      </div>
      <div
        className={cn(
          'mt-1 font-mono tabular-nums leading-tight',
          primary ? 'text-[17px] sm:text-[18px]' : 'text-[13px]',
          tone === 'pos' ? 'text-buy' : tone === 'neg' ? 'text-sell' : 'text-foreground'
        )}
      >
        {text}
      </div>
      {props.hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{props.hint}</div> : null}
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{props.title}</h2>
          {props.subtitle ? <p className="mt-0.5 text-[10px] text-muted-foreground">{props.subtitle}</p> : null}
        </div>
        {props.actions}
      </div>
      <div className="p-3 sm:p-4">{props.children}</div>
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
