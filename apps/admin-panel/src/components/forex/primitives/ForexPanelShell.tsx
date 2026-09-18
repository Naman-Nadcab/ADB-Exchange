'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export function ForexPanelShell(props: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <Card className={cn('border-admin-border/80 bg-admin-card/95', props.className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b border-admin-border/50 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{props.title}</h3>
          {props.description ? <p className="mt-0.5 text-xs text-admin-muted">{props.description}</p> : null}
        </div>
        {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
      </CardHeader>
      <CardContent className={cn(props.noPadding ? 'p-0' : 'pt-4')}>{props.children}</CardContent>
    </Card>
  );
}
