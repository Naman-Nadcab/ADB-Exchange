'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { HelpCircle, ScrollText } from 'lucide-react';
import { SmartTooltip } from '@/components/admin-v2/SmartTooltip';
import { cn } from '@/lib/cn';

/** Standard section chrome for Tier-1 operator pages. */
export function OperatorSection(props: {
  title: string;
  description: string;
  help?: string;
  helpDanger?: string;
  auditHref?: string;
  lastUpdated?: string | null;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { title, description, help, helpDanger, auditHref, lastUpdated, actions, children, className } = props;
  return (
    <section className={cn('rounded-xl border border-admin-border/60 bg-admin-card', className)}>
      <div className="flex flex-col gap-2 border-b border-admin-border/40 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-admin-text">{title}</h2>
            {help ? (
              <SmartTooltip content={help} danger={helpDanger}>
                <HelpCircle className="h-3.5 w-3.5 shrink-0 text-admin-muted" aria-hidden />
              </SmartTooltip>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-admin-muted">{description}</p>
          {lastUpdated ? (
            <p className="mt-1 text-[10px] text-admin-muted/80">Last updated: {lastUpdated}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {auditHref ? (
            <Link
              href={auditHref}
              className="inline-flex items-center gap-1 rounded-md border border-admin-border/50 px-2 py-1 text-[10px] text-admin-muted hover:text-admin-text"
            >
              <ScrollText className="h-3 w-3" /> Audit trail
            </Link>
          ) : null}
          {actions}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Inline hint for settings fields. */
export function SettingHint(props: {
  impact: string;
  restart?: boolean;
  risk?: 'low' | 'medium' | 'high';
  recommended?: string;
}) {
  const riskLabel = props.risk === 'high' ? 'High risk' : props.risk === 'medium' ? 'Medium risk' : 'Low risk';
  return (
    <p className="mt-1 text-[10px] leading-relaxed text-admin-muted">
      <span className="text-admin-muted/90">{props.impact}</span>
      {' · '}
      {props.restart ? 'Restart required' : 'Hot reload — no restart'}
      {props.risk ? ` · ${riskLabel}` : null}
      {props.recommended ? ` · Recommended: ${props.recommended}` : null}
    </p>
  );
}
