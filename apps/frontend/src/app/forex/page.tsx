'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ForexOrderTicket } from '@/components/forex/ForexOrderTicket';
import { ForexWatchlist } from '@/components/forex/ForexWatchlist';
import { ForexBottomPanels } from '@/components/forex/ForexBottomPanels';
import { useForexPhoneScreen, useMediaQuery } from '@/components/forex/ForexPhoneScreen';
import { useForexStore } from '@/lib/forex/state/store';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { useTranslations } from 'next-intl';

/**
 * Below `lg`, desktop docks are hidden.
 * Phones get one full screen at a time (chart, pairs, order, positions, history).
 * Tablets (`md` to `lg`) keep the order ticket under the chart because Market Watch
 * and the toolbox are already docked (FFX-001: never duplicate a docked surface).
 */
export default function ForexTradePage() {
  const t = useTranslations('forex.mobileTrade');
  const phone = useMediaQuery('(max-width: 767px)');
  const tablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const { screen, setScreen } = useForexPhoneScreen();
  const selectedSymbol = useForexWorkspaceStore((s) => s.selectedSymbol);
  const symbolRef = useRef(selectedSymbol);
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

  useEffect(() => {
    if (screen !== 'watch') {
      symbolRef.current = selectedSymbol;
      return;
    }
    if (symbolRef.current !== selectedSymbol) setScreen('chart');
    symbolRef.current = selectedSymbol;
  }, [screen, selectedSymbol, setScreen]);

  if (tablet) {
    return (
      <div className="min-h-[280px] max-h-[42vh] overflow-hidden">
        <ForexOrderTicket />
      </div>
    );
  }

  if (!phone) return null;

  if (screen === 'watch') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <button
          type="button"
          className="flex h-11 shrink-0 items-center border-b border-border px-3 text-left text-[13px] font-medium text-primary"
          onClick={() => setScreen('chart')}
        >
          {t('chart')}
        </button>
        <div className="min-h-0 flex-1">
          <ForexWatchlist />
        </div>
      </div>
    );
  }

  if (screen === 'trade') {
    return (
      <div className="h-full min-h-0">
        <ForexOrderTicket />
      </div>
    );
  }

  if (screen === 'book') {
    return (
      <div className="h-full min-h-0">
        <ForexBottomPanels compact={false} hasTradingData={hasTradingData} />
      </div>
    );
  }

  return null;
}
