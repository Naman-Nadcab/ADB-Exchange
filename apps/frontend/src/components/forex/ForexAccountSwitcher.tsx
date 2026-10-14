'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { forexEnumLabel } from '@/components/forex/forex-enum-label';
import { switchForexActiveAccount } from '@/lib/forex/runtime/hydrate';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';

export function ForexAccountSwitcher(props?: { compact?: boolean }) {
  const t = useTranslations('forex.accountSwitcher');
  const te = useTranslations('forex.enums');
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

  if (!accounts.length && !activeId) {
    return null;
  }

  const kindLabel = active?.accountKind ? forexEnumLabel(te, active.accountKind) : te('ACCOUNT');
  const label = active ? `${kindLabel} · ${active.currency}` : te('ACCOUNT');
  const status = active?.status ? forexEnumLabel(te, String(active.status)) : null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 max-w-[9rem] items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[11rem] ${props?.compact ? 'text-[11px]' : 'text-[12px]'}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('activeAccountAria')}
      >
        <span className="min-w-0 truncate font-medium text-foreground">
          {label}
          {status ? <span className="font-normal text-muted-foreground"> · {status}</span> : null}
        </span>
        <span className="shrink-0 text-muted-foreground" aria-hidden>
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
                {forexEnumLabel(te, a.accountKind)} · {a.currency}
                {a.accountId === activeId ? ` · ${t('activeSuffix')}` : ''}
              </span>
              <span className="pointer-events-none font-mono text-[10px] text-muted-foreground">
                #{a.accountId}
                {a.status ? ` · ${forexEnumLabel(te, String(a.status))}` : ''}
                {a.positionMode ? ` · ${forexEnumLabel(te, a.positionMode)}` : ''}
              </span>
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <Link
            href={FOREX_ROUTES.accounts}
            className="block px-3 py-2 text-[11px] text-primary hover:bg-muted/60"
            onClick={() => setOpen(false)}
          >
            {t('manageAccounts')}
          </Link>
          <Link
            href={FOREX_ROUTES.openDemoAccount}
            className="block border-t border-border px-3 py-2 text-[11px] font-semibold text-primary hover:bg-muted/60"
            onClick={() => setOpen(false)}
          >
            {t('createDemo')}
          </Link>
          <p className="px-3 pb-2 text-[10px] text-muted-foreground">{t('simulatedNote')}</p>
        </div>
      ) : null}
    </div>
  );
}
