'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ForexDetailItem = {
  label: string;
  value: ReactNode;
  mono?: boolean;
  highlight?: 'default' | 'success' | 'warning' | 'danger';
};

export function ForexDetailGrid(props: { items: ForexDetailItem[]; columns?: 2 | 3 | 4; className?: string }) {
  const cols = props.columns ?? 2;
  return (
    <dl
      className={cn(
        'grid gap-3',
        cols === 2 && 'sm:grid-cols-2',
        cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        props.className,
      )}
    >
      {props.items.map((item) => (
        <div key={item.label} className="rounded-lg border border-admin-border/70 bg-admin-bg/30 px-3 py-2.5">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-admin-muted">{item.label}</dt>
          <dd
            className={cn(
              'mt-1 text-sm font-medium text-foreground',
              item.mono && 'font-mono text-xs',
              item.highlight === 'success' && 'text-emerald-400',
              item.highlight === 'warning' && 'text-amber-400',
              item.highlight === 'danger' && 'text-red-400',
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
