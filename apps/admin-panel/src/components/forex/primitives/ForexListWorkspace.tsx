'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ForexFilterBar, ForexSectionLabel, ForexWorkspaceSurface } from '@/components/forex/primitives/forex-visual-kit';
import type { ForexSemanticTone } from '@/components/forex/primitives/forex-semantic-system';

/** Dense table workspace — filter bar + table in one premium surface. */
export function ForexListWorkspace(props: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: ForexSemanticTone;
  toolbar?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
}) {
  return (
    <ForexWorkspaceSurface noPadding className="overflow-hidden">
      <div className="border-b border-admin-border/60 px-4 py-3">
        <ForexSectionLabel icon={props.icon}>{props.title}</ForexSectionLabel>
        {props.description ? <p className="text-xs text-admin-muted">{props.description}</p> : null}
        {props.filters ? <ForexFilterBar className="mt-2 border-0 bg-transparent p-0">{props.filters}</ForexFilterBar> : null}
        {props.toolbar ? <div className="mt-2 flex flex-wrap items-center justify-end gap-2">{props.toolbar}</div> : null}
      </div>
      <div className={props.noPadding !== false ? 'p-0' : 'p-4'}>{props.children}</div>
      {props.footer ? <div className="border-t border-admin-border/60 px-4 py-2">{props.footer}</div> : null}
    </ForexWorkspaceSurface>
  );
}
