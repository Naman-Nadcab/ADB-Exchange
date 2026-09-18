'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

export function ForexEmptyState(props: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = props.icon ?? Inbox;
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-admin-border/80 bg-admin-bg/20 px-6 py-12 text-center', props.className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <Icon className="h-6 w-6 text-admin-muted" />
      </div>
      <p className="text-sm font-medium text-foreground">{props.title}</p>
      {props.description ? <p className="mt-1 max-w-md text-xs text-admin-muted">{props.description}</p> : null}
      {props.action ? <div className="mt-4">{props.action}</div> : null}
    </div>
  );
}
