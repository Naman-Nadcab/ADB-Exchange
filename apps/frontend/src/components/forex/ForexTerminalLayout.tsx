'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isForexTradePath, showForexMarketChrome } from '@/lib/forex/routes';
import { useForexRuntime } from '@/lib/forex/runtime/useForexRuntime';
import { useForexStore } from '@/lib/forex/state/store';
import { resolveForexBottomHeight, useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { ForexAccountBar } from './ForexAccountBar';
import { ForexBottomPanels } from './ForexBottomPanels';
import { ForexChartFoundation } from './ForexChartFoundation';
import { ForexMarketStrip } from './ForexMarketStrip';
import { ForexMobileNav } from './ForexMobileNav';
import { ForexOrderTicket } from './ForexOrderTicket';
import { ForexRiskBar } from './ForexRiskBar';
import { ForexSessionBar } from './ForexSessionBar';
import { ForexTopNav } from './ForexTopNav';
import { ForexWatchlist } from './ForexWatchlist';

export function ForexTerminalLayout({ children }: { children: ReactNode }) {
  useForexRuntime();
  const pathname = usePathname() ?? '';
  const trade = isForexTradePath(pathname);
  const marketChrome = showForexMarketChrome(pathname);
  const wlW = useForexWorkspaceStore((s) => s.watchlistWidth);
  const tkW = useForexWorkspaceStore((s) => s.ticketWidth);
  const bottomPreferred = useForexWorkspaceStore((s) => s.bottomHeight);
  const bottomCollapsed = useForexWorkspaceStore((s) => s.bottomCollapsed);
  const setBottomCollapsed = useForexWorkspaceStore((s) => s.setBottomCollapsed);
  const chartMode = useForexWorkspaceStore((s) => s.chartMode);
  const setChartMode = useForexWorkspaceStore((s) => s.setChartMode);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const hydrateError = useForexStore((s) => s.hydrateError);
  const positions = useForexStore((s) => s.positions);
  const orders = useForexStore((s) => s.orders);

  const hasTradingData = useMemo(() => {
    const openPos = Object.values(positions).some((p) => p.status === 'OPEN');
    const openOrd = Object.values(orders).some((o) => {
      const st = String(o.status ?? '').toUpperCase();
      return st === 'NEW' || st === 'PARTIAL' || st === 'OPEN' || st === 'WORKING' || st === 'ACCEPTED';
    });
    return openPos || openOrd;
  }, [positions, orders]);

  // When positions/orders appear, reclaim a useful bottom height automatically.
  useEffect(() => {
    if (hasTradingData) setBottomCollapsed(false);
  }, [hasTradingData, setBottomCollapsed]);

  const bottomH = resolveForexBottomHeight({
    chartMode,
    bottomCollapsed,
    preferredHeight: bottomPreferred,
  });

  const showWatchlist = chartMode === 'normal';
  const showTicket = chartMode === 'normal';
  const chromeHidden = chartMode === 'fullscreen';

  useEffect(() => {
    if (chartMode !== 'fullscreen' && chartMode !== 'expand') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChartMode('normal');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chartMode, setChartMode]);

  return (
    <div
      className={`dark terminal-shell exchange-ui flex h-[100dvh] flex-col bg-background text-foreground antialiased ${
        chromeHidden ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {!chromeHidden ? <ForexTopNav /> : null}
      {!chromeHidden && marketChrome ? <ForexMarketStrip /> : null}
      {!chromeHidden && marketChrome ? <ForexSessionBar /> : null}
      {hydratePhase === 'error' && hydrateError ? (
        <div className="border-b border-sell/40 bg-sell/10 px-3 py-1 text-[11px] text-sell" role="alert">
          Unable to load Forex workspace. {hydrateError.message}
        </div>
      ) : null}

      {trade ? (
        <div className="relative flex min-h-0 flex-1">
          {showWatchlist ? (
            <div className="hidden min-h-0 shrink-0 border-r border-border md:block" style={{ width: wlW }}>
              <ForexWatchlist />
            </div>
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Chart is the primary surface on all breakpoints */}
            <div className="flex min-h-0 min-w-0 flex-1">
              <ForexChartFoundation />
              {showTicket ? (
                <div className="hidden min-h-0 shrink-0 border-l border-border lg:block" style={{ width: tkW }}>
                  <ForexOrderTicket />
                </div>
              ) : null}
            </div>

            {bottomH > 0 ? (
              <div className="hidden shrink-0 md:flex" style={{ height: bottomH }}>
                <div className="min-h-0 min-w-0 flex-1">
                  <ForexBottomPanels compact={bottomH <= 56} hasTradingData={hasTradingData} />
                </div>
              </div>
            ) : null}
          </div>

          {chartMode === 'expand' || chartMode === 'fullscreen' ? (
            <button
              type="button"
              onClick={() => setChartMode('normal')}
              className="absolute right-3 top-3 z-30 rounded border border-border bg-card/95 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-md backdrop-blur"
            >
              {chartMode === 'fullscreen' ? 'Exit fullscreen' : 'Restore panels'}
            </button>
          ) : null}
        </div>
      ) : (
        <main className="min-h-0 flex-1 overflow-auto bg-background">{children}</main>
      )}

      {/* Mobile: ticket/watchlist fragments under the chart — never a second chart */}
      {trade && chartMode === 'normal' ? (
        <div className="max-h-[38vh] min-h-0 overflow-auto border-t border-border md:hidden">
          {children}
          <ForexBottomPanels compact={!hasTradingData} hasTradingData={hasTradingData} />
        </div>
      ) : null}

      {trade && chartMode === 'normal' ? <ForexRiskBar /> : null}
      {!chromeHidden ? <ForexAccountBar /> : null}
      {!chromeHidden ? <ForexMobileNav /> : null}
    </div>
  );
}
