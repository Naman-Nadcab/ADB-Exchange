'use client';

import { useMemo, useState } from 'react';
import { ForexOrderTicket } from '@/components/forex/ForexOrderTicket';
import { ForexWatchlist } from '@/components/forex/ForexWatchlist';
import { ForexBottomPanels } from '@/components/forex/ForexBottomPanels';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type MobileTab = 'watch' | 'ticket' | 'toolbox';

/**
 * Companion panels under the chart for viewports below `lg` (desktop uses ForexTerminalLayout docks).
 * Below `md` it offers Watch / Order / Trade tabs; between `md` and `lg` the layout already docks the
 * watchlist and toolbox but not the order ticket, so only the ticket is shown here (FFX-001: never
 * duplicate a surface that is docked at the current breakpoint).
 */
export default function ForexTradePage() {
  const t = useTranslations('forex.mobileTrade');
  const [tab, setTab] = useState<MobileTab>('ticket');
  const positions = useForexStore((s) => s.positions);
  const orders = useForexStore((s) => s.orders);
  const bottomCollapsed = useForexWorkspaceStore((s) => s.bottomCollapsed);
  const hasTradingData = useMemo(() => {
    const openPos = Object.values(positions).some((p) => p.status === 'OPEN');
    const openOrd = Object.values(orders).some((o) => {
      const st = String(o.status ?? '').toUpperCase();
      return st === 'NEW' || st === 'PARTIAL' || st === 'OPEN' || st === 'WORKING' || st === 'ACCEPTED';
    });
    return openPos || openOrd;
  }, [positions, orders]);

  return (
    <div className="grid gap-0 lg:hidden">
      <div className="flex h-8 items-center gap-1 border-b border-border bg-card px-2 md:hidden" role="tablist">
        {(
          [
            { id: 'watch' as const, labelKey: 'watch' as const },
            { id: 'ticket' as const, labelKey: 'order' as const },
            { id: 'toolbox' as const, labelKey: 'trade' as const },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium',
              tab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>
      <div className="min-h-[280px] max-h-[42vh] overflow-hidden">
        {tab === 'watch' ? (
          <div className="md:hidden">
            <ForexWatchlist />
          </div>
        ) : null}
        <div className={cn(tab === 'ticket' ? 'block' : 'hidden md:block')}>
          <ForexOrderTicket />
        </div>
        {tab === 'toolbox' ? (
          <div className="md:hidden">
            <ForexBottomPanels compact={bottomCollapsed} hasTradingData={hasTradingData} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
