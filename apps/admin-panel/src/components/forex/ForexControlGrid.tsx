'use client';

import Link from 'next/link';
import type { ForexControlDef, ForexControlGroup } from '@/lib/admin/forex-control-registry';
import { FOREX_ADMIN_PHASES } from '@/lib/admin/forex-admin-nav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { AlertTriangle, ChevronRight, Link2 } from 'lucide-react';

function phaseLabel(phase: string): string {
  return FOREX_ADMIN_PHASES.find((p) => p.id === phase)?.title ?? phase;
}

function ControlRow({ c }: { c: ForexControlDef }) {
  const disabled = !c.wired;
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-admin-border/80 bg-admin-bg/40 p-3 sm:flex-row sm:items-center sm:justify-between',
        c.dangerous && 'border-red-500/30',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{c.label}</span>
          <Badge variant="default" className="text-[10px]">
            {c.phase}
          </Badge>
          {c.dangerous ? (
            <Badge variant="danger" className="gap-0.5 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              High impact
            </Badge>
          ) : null}
          {!c.wired ? (
            <Badge variant="info" className="text-[10px]">
              Shell · API pending
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px]">
              Live
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-admin-muted">{c.description}</p>
        <p className="mt-1 text-[10px] text-admin-muted/80">Wire target: {phaseLabel(c.phase)}</p>
      </div>
      <div className="shrink-0">
        {c.kind === 'toggle' ? (
          <Button type="button" size="sm" variant="secondary" disabled={disabled}>
            {disabled ? 'Connect API' : 'Toggle'}
          </Button>
        ) : c.kind === 'action' ? (
          <Button type="button" size="sm" variant={c.dangerous ? 'danger' : 'secondary'} disabled={disabled}>
            Run
          </Button>
        ) : c.kind === 'table' ? (
          <Button type="button" size="sm" variant="outline" disabled={disabled}>
            Open table
          </Button>
        ) : (
          <span className="text-xs text-admin-muted">Read-only</span>
        )}
      </div>
    </div>
  );
}

export function ForexControlGrid(props: { groups: ForexControlGroup[]; compact?: boolean }) {
  const { groups, compact } = props;
  if (groups.length === 0) {
    return (
      <p className="text-sm text-admin-muted">No control groups mapped for this section yet.</p>
    );
  }

  return (
    <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'lg:grid-cols-2')}>
      {groups.map((g) => (
        <Card key={g.id} className="border-admin-border/90 bg-admin-card/80">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <h3 className="text-sm font-semibold">{g.title}</h3>
              <Link
                href={g.sectionRoute}
                className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-violet-400 hover:underline"
              >
                <Link2 className="h-3 w-3" />
                {g.sectionRoute}
              </Link>
            </div>
            <ChevronRight className="h-4 w-4 text-admin-muted" />
          </CardHeader>
          <CardContent className="space-y-2">
            {g.controls.map((c) => (
              <ControlRow key={c.id} c={c} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
