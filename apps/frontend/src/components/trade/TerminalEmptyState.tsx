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
  return (
    <div
      className={`terminal-empty flex flex-col items-center justify-center text-center ${
        compact ? 'px-3 py-4' : 'px-4 py-8'
      }`}
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
