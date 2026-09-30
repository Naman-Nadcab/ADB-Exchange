'use client';

import { useState } from 'react';
import { ForexOrderTicket } from '@/components/forex/ForexOrderTicket';
import { ForexWatchlist } from '@/components/forex/ForexWatchlist';
import { ForexBottomPanels } from '@/components/forex/ForexBottomPanels';
import { cn } from '@/lib/utils';

type MobileTab = 'watch' | 'ticket' | 'toolbox';

/** Mobile companion panels under the chart (desktop uses ForexTerminalLayout docks). */
export default function ForexTradePage() {
  const [tab, setTab] = useState<MobileTab>('ticket');

  return (
    <div className="grid gap-0 md:hidden">
      <div className="flex h-8 items-center gap-1 border-b border-border bg-card px-2" role="tablist">
        {(
          [
            { id: 'watch', label: 'Watch' },
            { id: 'ticket', label: 'Order' },
            { id: 'toolbox', label: 'Trade' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-[280px] max-h-[42vh] overflow-hidden">
        {tab === 'watch' ? <ForexWatchlist /> : null}
        {tab === 'ticket' ? <ForexOrderTicket /> : null}
        {tab === 'toolbox' ? <ForexBottomPanels hasTradingData={false} /> : null}
      </div>
    </div>
  );
}
