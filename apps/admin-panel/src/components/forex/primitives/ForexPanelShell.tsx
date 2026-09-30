'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ForexSectionLabel, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';
import { FOREX_SEMANTIC, type ForexSemanticTone } from '@/components/forex/primitives/forex-semantic-system';

export function ForexPanelShell(props: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  /** Semantic accent for section chrome (danger = kill-switch style blocks). */
  tone?: ForexSemanticTone;
  icon?: LucideIcon;
}) {
  const sem = FOREX_SEMANTIC[props.tone ?? 'neutral'];
  return (
    <ForexWorkspaceSurface
      noPadding
      className={cn('overflow-hidden', props.tone && props.tone !== 'neutral' && cn(sem.border, sem.surface), props.className)}
    >
      <div
        className={cn(
          'flex flex-row flex-wrap items-start justify-between gap-2 border-b border-admin-border/60 px-4 py-3',
          props.tone && props.tone !== 'neutral' && cn('border-l-4', sem.stripe),
        )}
      >
        <div className="min-w-0">
          <ForexSectionLabel icon={props.icon}>{props.title}</ForexSectionLabel>
          {props.description ? <p className="text-xs leading-snug text-admin-muted">{props.description}</p> : null}
        </div>
        {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
      </div>
      <div className={cn(props.noPadding ? 'p-0' : 'p-4')}>{props.children}</div>
    </ForexWorkspaceSurface>
  );
}
