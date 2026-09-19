'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { createForexDemoAccountAndActivate, switchForexActiveAccount } from '@/lib/forex/runtime/hydrate';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';

export function ForexAccountSwitcher(props?: { compact?: boolean }) {
  const accounts = useForexStore((s) => s.forexAccounts);
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const active = accounts.find((a) => a.accountId === activeId) ?? accounts[0];

  const onSelect = useCallback(async (accountId: string) => {
    if (busy || accountId === activeId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await switchForexActiveAccount(accountId);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [activeId, busy]);

  const onCreate = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createForexDemoAccountAndActivate();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [busy]);

  if (!accounts.length && !activeId) {
    return null;
  }

  const label = active
    ? `${active.accountKind === 'DEMO' ? 'Demo' : active.accountKind} · ${active.currency}`
    : 'Account';
  const status = active?.status ? String(active.status) : null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={`flex max-w-[260px] items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${props?.compact ? 'text-[10px]' : 'text-[11px]'}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Active Forex account"
      >
        <span className="min-w-0 truncate">
          <span className="block truncate font-medium text-foreground">
            {label}
            {status ? <span className="ml-1 font-normal text-muted-foreground">· {status}</span> : null}
          </span>
          <span className="block truncate font-mono text-[10px] text-muted-foreground">
            #{active?.accountId ?? activeId}
            {active?.positionMode ? ` · ${active.positionMode}` : ''}
          </span>
        </span>
        <span className="text-muted-foreground" aria-hidden>
          ▼
        </span>
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[240px] rounded-md border border-border bg-popover py-1 shadow-md"
          role="listbox"
        >
          {accounts.map((a) => (
            <button
              key={a.accountId}
              type="button"
              role="option"
              aria-selected={a.accountId === activeId}
              className={`flex w-full flex-col px-3 py-2 text-left text-[11px] hover:bg-muted/60 ${
                a.accountId === activeId ? 'bg-muted/50' : ''
              }`}
              onClick={() => void onSelect(a.accountId)}
            >
              <span className="pointer-events-none font-medium">
                {a.accountKind === 'DEMO' ? 'Demo' : a.accountKind} · {a.currency}
                {a.accountId === activeId ? ' · Active' : ''}
              </span>
              <span className="pointer-events-none font-mono text-[10px] text-muted-foreground">
                #{a.accountId}
                {a.status ? ` · ${a.status}` : ''}
                {a.positionMode ? ` · ${a.positionMode}` : ''}
              </span>
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <Link
            href={FOREX_ROUTES.accounts}
            className="block px-3 py-2 text-[11px] text-primary hover:bg-muted/60"
            onClick={() => setOpen(false)}
          >
            Manage accounts…
          </Link>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-[11px] font-semibold text-primary hover:bg-muted/60"
            onClick={() => void onCreate()}
          >
            + Create demo account
          </button>
          <p className="px-3 pb-2 text-[9px] text-muted-foreground">SIMULATED · not real money</p>
        </div>
      ) : null}
    </div>
  );
}
