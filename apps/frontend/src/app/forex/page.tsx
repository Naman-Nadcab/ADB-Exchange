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

/** Mobile companion panels under the chart (desktop uses ForexTerminalLayout docks). */
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
    <div className="grid gap-0 md:hidden">
      <div className="flex h-8 items-center gap-1 border-b border-border bg-card px-2" role="tablist">
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
        {tab === 'watch' ? <ForexWatchlist /> : null}
        {tab === 'ticket' ? <ForexOrderTicket /> : null}
        {tab === 'toolbox' ? (
          <ForexBottomPanels compact={bottomCollapsed} hasTradingData={hasTradingData} />
        ) : null}
      </div>
    </div>
  );
}
