'use client';

import type { ForexWorkspaceId } from '@/lib/forex/models/types';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { cn } from '@/lib/utils';

const ITEMS: { id: ForexWorkspaceId; label: string }[] = [
  { id: 'trading', label: 'Trading' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'custom', label: 'Custom' },
];

export function ForexWorkspaceSwitch() {
  const workspace = useForexWorkspaceStore((s) => s.workspace);
  const setWorkspace = useForexWorkspaceStore((s) => s.setWorkspace);
  const panels = useForexWorkspaceStore((s) => s.panels);
  const setPanel = useForexWorkspaceStore((s) => s.setPanel);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-stone-50 px-3 py-1 text-[11px] dark:border-stone-800 dark:bg-[#121416]">
      <span className="text-stone-400">Workspace</span>
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
            'rounded px-2 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400',
            workspace === w.id ? 'bg-white font-medium shadow-none dark:bg-stone-800' : 'text-stone-500'
          )}
        >
          {w.label}
        </button>
      ))}
      <span className="ml-auto text-stone-400">
        Local only · {panels.watchlist ? 'WL' : ''} {panels.chart ? 'CH' : ''} {panels.ticket ? 'TK' : ''}
      </span>
    </div>
  );
}
