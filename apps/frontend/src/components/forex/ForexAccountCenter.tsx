'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { fxPlain } from '@/components/forex/format';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import {
  createForexDemoAccountAndActivate,
  switchForexActiveAccount,
  syncForexAccountsFromServer,
} from '@/lib/forex/runtime/hydrate';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

export function ForexAccountCenter() {
  const t = useTranslations('forex.accountCenter');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const accounts = useForexStore((s) => s.forexAccounts);
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const hydratePhase = useForexStore((s) => s.hydratePhase);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function kindLabel(kind: string): string {
    const k = kind.toUpperCase();
    if (k === 'DEMO') return t('kindDemo');
    if (k === 'LIVE' || k === 'REAL') return t('kindLive');
    return kind;
  }

  const reload = useCallback(async () => {
    if (!authed) return;
    await syncForexAccountsFromServer();
  }, [authed]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreateDemo() {
    if (busy) return;
    setBusy('create');
    setErr(null);
    setNote(null);
    try {
      const ok = await createForexDemoAccountAndActivate();
      if (!ok) {
        setErr(t('createDemoFailed'));
        return;
      }
      await reload();
      setNote(t('createDemoSuccess'));
    } finally {
      setBusy(null);
    }
  }

  async function onSwitch(accountId: string) {
    if (busy || accountId === activeId) return;
    setBusy(accountId);
    setErr(null);
    setNote(null);
    try {
      const ok = await switchForexActiveAccount(accountId);
      if (!ok) {
        setErr(t('switchFailed'));
        return;
      }
      await reload();
      setNote(t('activeAccount', { accountId }));
    } finally {
      setBusy(null);
    }
  }

  if (!authed) {
    return <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.accounts}`} sectionKey="forexAccounts" />;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void onCreateDemo()}
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy === 'create' ? t('createDemoBusy') : t('createDemo')}
        </button>
        <Link
          href={FOREX_ROUTES.trade}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:border-primary/40"
        >
          {t('openTradeTerminal')}
        </Link>
      </div>

      {note ? <p className="text-sm text-buy">{note}</p> : null}
      {err ? <p className="text-sm text-sell">{err}</p> : null}
      {hydratePhase === 'hydrating' && !accounts.length ? (
        <p className="text-sm text-muted-foreground">{t('loadingAccounts')}</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t('colAccountId')}</th>
              <th className="px-3 py-2 font-medium">{t('colType')}</th>
              <th className="px-3 py-2 font-medium">{t('colStatus')}</th>
              <th className="px-3 py-2 font-medium">{t('colCurrency')}</th>
              <th className="px-3 py-2 font-medium">{t('colPositionMode')}</th>
              <th className="px-3 py-2 font-medium">{t('colLeverage')}</th>
              <th className="px-3 py-2 font-medium">{t('colActive')}</th>
              <th className="px-3 py-2 font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const isActive = a.accountId === activeId;
              const lev =
                'leverageOverride' in a && a.leverageOverride ? String(a.leverageOverride) : '—';
              return (
                <tr key={a.accountId} className={cn('border-b border-border/60', isActive && 'bg-primary/5')}>
                  <td className="px-3 py-2 font-mono">{fxPlain(a.accountId)}</td>
                  <td className="px-3 py-2">{kindLabel(a.accountKind)}</td>
                  <td className="px-3 py-2">{fxPlain(a.status)}</td>
                  <td className="px-3 py-2">{fxPlain(a.currency)}</td>
                  <td className="px-3 py-2">{fxPlain(a.positionMode)}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{lev}</td>
                  <td className="px-3 py-2">{isActive ? t('yes') : '—'}</td>
                  <td className="px-3 py-2">
                    {isActive ? (
                      <span className="text-muted-foreground">{t('current')}</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy != null}
                        onClick={() => void onSwitch(a.accountId)}
                        className="rounded border border-border px-2 py-1 text-[11px] font-medium hover:border-primary/40 disabled:opacity-50"
                      >
                        {busy === a.accountId ? t('switching') : t('switch')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!accounts.length && hydratePhase !== 'hydrating' ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {t.rich('quickSwitchHint', {
          tradeLink: (chunks) => (
            <Link href={FOREX_ROUTES.trade} className="text-primary underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </>
  );
}
