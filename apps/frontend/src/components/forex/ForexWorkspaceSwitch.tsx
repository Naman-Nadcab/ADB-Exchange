'use client';

import { useTranslations } from 'next-intl';
import type { ForexWorkspaceId } from '@/lib/forex/models/types';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';

/** Compact profile presets for panel visibility — used from chart workspace when needed. */
export function ForexWorkspaceSwitch() {
  const t = useTranslations('forex.workspaceSwitch');
  const ITEMS: { id: ForexWorkspaceId; labelKey: 'trading' | 'analysis' | 'portfolio' | 'custom' }[] = [
    { id: 'trading', labelKey: 'trading' },
    { id: 'analysis', labelKey: 'analysis' },
    { id: 'portfolio', labelKey: 'portfolio' },
    { id: 'custom', labelKey: 'custom' },
  ];
  const workspace = useForexWorkspaceStore((s) => s.workspace);
  const setWorkspace = useForexWorkspaceStore((s) => s.setWorkspace);
  const panels = useForexWorkspaceStore((s) => s.panels);
  const setPanel = useForexWorkspaceStore((s) => s.setPanel);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-0.5 text-[10px]">
      <span className="text-muted-foreground">{t('profileLabel')}</span>
      {ITEMS.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => {
            setWorkspace(w.id);
            if (w.id === 'analysis') {
              setPanel('ticket', false);
              setPanel('chart', true);
              setPanel('watchlist', true);
            } else if (w.id === 'portfolio') {
              setPanel('ticket', false);
              setPanel('positions', true);
              setPanel('risk', true);
            } else if (w.id === 'trading') {
              setPanel('ticket', true);
              setPanel('chart', true);
              setPanel('watchlist', true);
              setPanel('positions', true);
            }
          }}
          className={cn(
            'rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            workspace === w.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t(w.labelKey)}
        </button>
      ))}
      <span className="ml-auto font-mono text-[9px] text-muted-foreground">
        {panels.watchlist ? 'MW' : ''} {panels.ticket ? 'TK' : ''} local
      </span>
    </div>
  );
}
