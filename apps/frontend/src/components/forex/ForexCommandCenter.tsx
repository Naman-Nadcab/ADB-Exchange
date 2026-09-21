'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForexWorkspaceStore } from '@/lib/forex/state/workspace';
import { describeCustomerOrderLabel } from '@/lib/forex/presentation/order-type-labels';
import type { ForexOrderType, ForexSide } from '@/lib/forex/models/types';

type Cmd = { id: string; label: string; hint?: string; run: () => void };

export function ForexCommandCenter() {
  const tf = useTranslations('forex');
  const tc = useTranslations('forex.commandCenter');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const focusSymbol = useForexWorkspaceStore((s) => s.focusSymbol);
  const setBottomTab = useForexWorkspaceStore((s) => s.setBottomTab);
  const setTicketDraft = useForexWorkspaceStore((s) => s.setTicketDraft);
  const symbols = useForexWorkspaceStore((s) => s.watchlist);

  const base = useCallback((): Cmd[] => {
    const draft = (side: ForexSide, orderType: ForexOrderType) => {
      setTicketDraft({ nonce: Date.now(), side, orderType });
      setBottomTab('positions');
    };
    return [
      { id: 'history', label: tc('openHistory'), run: () => setBottomTab('history') },
      { id: 'dom', label: tc('openDom'), run: () => setBottomTab('dom') },
      { id: 'risk', label: tc('openRisk'), run: () => setBottomTab('analytics') },
      { id: 'alerts', label: tc('openAlerts'), run: () => setBottomTab('alerts') },
      { id: 'tape', label: tc('openTape'), run: () => setBottomTab('tape') },
      { id: 'calendar', label: tc('openCalendar'), run: () => setBottomTab('calendar') },
      { id: 'news', label: tc('openNews'), run: () => setBottomTab('news') },
      { id: 'orders', label: tc('openOrders'), run: () => setBottomTab('orders') },
      ...(['buy', 'sell'] as ForexSide[]).flatMap((side) =>
        (['market', 'limit', 'stop', 'stop_limit'] as ForexOrderType[]).map((orderType) => ({
          id: `${side}-${orderType}`,
          label: describeCustomerOrderLabel(tf, side, orderType),
          hint: tc('draftHint'),
          run: () => draft(side, orderType),
        }))
      ),
      ...symbols.slice(0, 12).map((sym) => ({
        id: `sym-${sym}`,
        label: tc('chartSymbol', { symbol: sym }),
        run: () => focusSymbol(sym),
      })),
    ];
  }, [focusSymbol, setBottomTab, setTicketDraft, symbols, tc, tf]);

  const cmds = useMemo(() => {
    const all = base();
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((c) => c.label.toLowerCase().includes(needle) || c.id.includes(needle));
  }, [base, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      const path = window.location.pathname;
      if (!path.includes('/forex')) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 p-4 pt-[12vh]" role="dialog" aria-label={tc('ariaLabel')}>
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-3 py-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tc('placeholder')}
            className="w-full bg-transparent text-sm outline-none"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">{tc('hint')}</p>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {cmds.slice(0, 24).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-left text-[12px] hover:bg-accent/50"
                onClick={() => {
                  c.run();
                  setOpen(false);
                  setQ('');
                }}
              >
                <span className="font-medium text-foreground">{c.label}</span>
                {c.hint ? <span className="text-[10px] text-muted-foreground">{c.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-border px-3 py-2">
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
            {tc('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
