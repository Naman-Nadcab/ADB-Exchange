'use client';

import type { ReactNode } from 'react';
import { useForexRuntime } from '@/lib/forex/runtime/useForexRuntime';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { ForexAccountBar } from './ForexAccountBar';
import { ForexBottomPanels } from './ForexBottomPanels';
import { ForexChartFoundation } from './ForexChartFoundation';
import { ForexMarketStrip } from './ForexMarketStrip';
import { ForexOrderTicket } from './ForexOrderTicket';
import { ForexRiskBar } from './ForexRiskBar';
import { ForexSessionBar } from './ForexSessionBar';
import { ForexTopNav } from './ForexTopNav';
import { ForexWatchlist } from './ForexWatchlist';
import { ForexWorkspaceSwitch } from './ForexWorkspaceSwitch';

export function ForexTerminalLayout({ children }: { children: ReactNode }) {
  useForexRuntime();
  const panels = useForexWorkspaceStore((s) => s.panels);
  const wlW = useForexWorkspaceStore((s) => s.watchlistWidth);
  const tkW = useForexWorkspaceStore((s) => s.ticketWidth);
  const bottomH = useForexWorkspaceStore((s) => s.bottomHeight);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const hydrateError = useForexStore((s) => s.hydrateError);

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f4f3ef] text-stone-800 antialiased dark:bg-[#0a0b0c] dark:text-stone-100">
      <ForexTopNav />
      <ForexWorkspaceSwitch />
      <ForexMarketStrip />
      <ForexSessionBar />
      {hydratePhase === 'error' && hydrateError ? (
        <div className="border-b border-rose-300 bg-rose-50 px-3 py-1 text-[11px] text-rose-900 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
          {hydrateError.code}: {hydrateError.message}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {panels.watchlist ? (
          <div className="hidden min-h-0 md:block" style={{ width: wlW }}>
            <ForexWatchlist />
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            {panels.chart ? <ForexChartFoundation /> : <div className="min-w-0 flex-1 overflow-auto">{children}</div>}
            {panels.ticket ? (
              <div className="hidden min-h-0 lg:block" style={{ width: tkW }}>
                <ForexOrderTicket />
              </div>
            ) : null}
          </div>
          <div className="hidden md:flex" style={{ height: bottomH }}>
            <div className="min-h-0 min-w-0 flex-1">
              <ForexBottomPanels />
            </div>
          </div>
        </div>
      </div>
      <div className="md:hidden min-h-0 flex-1 overflow-auto border-t border-stone-200 dark:border-stone-800">
        {children}
        <ForexBottomPanels />
      </div>
      <ForexRiskBar />
      <ForexAccountBar />
    </div>
  );
}
