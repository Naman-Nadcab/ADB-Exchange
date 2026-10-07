'use client';

import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import { Activity, ClipboardList, Inbox, LineChart } from 'lucide-react';

const ICONS = {
  orders: ClipboardList,
  trades: Activity,
  markets: LineChart,
  generic: Inbox,
} as const satisfies Record<string, LucideIcon>;

type TerminalEmptyKind = keyof typeof ICONS;

export function TerminalEmptyState({
  kind = 'generic',
  title,
  description,
  compact = false,
}: {
  kind?: TerminalEmptyKind;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  const Icon = ICONS[kind];
  if (compact) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" role="status">
        <div className="mx-1.5 mt-1.5 shrink-0 rounded border border-border bg-muted/40 px-2 py-1.5 text-left">
          <p className="terminal-text-secondary font-medium text-foreground">{title}</p>
          {description ? <p className="terminal-text-meta mt-0.5 text-muted-foreground">{description}</p> : null}
        </div>
        <div
          className="mt-1 min-h-[6rem] flex-1"
          aria-hidden
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0, transparent 27px, hsl(var(--primary) / 0.16) 28px)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="terminal-empty flex flex-col items-center justify-center px-4 py-8 text-center"
      role="status"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-muted/40">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="terminal-text-secondary font-medium text-foreground">{title}</p>
      {description ? (
        <p className="terminal-text-meta mt-1 max-w-[220px] text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function TerminalLoadingRows({ rows = 8 }: { rows?: number }) {
  const t = useTranslations('crypto.terminal');
  return (
    <div className="flex flex-col gap-1 px-3 py-2" role="status" aria-busy="true" aria-label={t('loadingRowsAria')}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="terminal-shimmer-row flex items-center gap-2 py-2">
          <span className="h-3 flex-1 rounded-md bg-muted/70" />
          <span className="h-3 w-16 rounded-md bg-muted/60" />
          <span className="h-3 w-12 rounded-md bg-muted/50" />
        </div>
      ))}
    </div>
  );
}
