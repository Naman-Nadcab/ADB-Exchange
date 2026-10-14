'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { KeyRound, Lock, Shield } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from './ForexPortalKpiCard';

/** Platform + gated trading credential guidance — never shows secrets. */
export function ForexTradingCredentialPanel({ accountId }: { accountId: string }) {
  const t = useTranslations('forex.credentials');
  const [state, setState] = useState<{
    tradingAvailable: boolean;
    tradingReason: string | null;
    investorAvailable: boolean;
    investorReason: string | null;
  } | null>(null);
  const [busy, setBusy] = useState<'TRADING' | 'INVESTOR' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = unwrap(await forexApi.getAccountCredentials(accountId));
      if (res.ok) {
        setState({
          tradingAvailable: res.data.tradingPassword.available,
          tradingReason: res.data.tradingPassword.reason,
          investorAvailable: res.data.investorPassword.available,
          investorReason: res.data.investorPassword.reason,
        });
      }
    })();
  }, [accountId]);

  async function request(kind: 'TRADING' | 'INVESTOR') {
    if (busy) return;
    setBusy(kind);
    setErr(null);
    setNote(null);
    const res = unwrap(
      await forexApi.requestBrokerCredential(accountId, {
        kind,
        idempotencyKey: `cred:${kind}:${accountId}:${Date.now()}`,
      }),
    );
    setBusy(null);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    setNote(t('requested'));
  }

  return (
    <ForexPortalModuleCard title={t('title')} subtitle={t('subtitle')}>
      <div className="space-y-3">
        <div className="rounded border border-border/70 bg-muted/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
              <p className="text-[12px] font-medium">{t('platformLoginTitle')}</p>
            </div>
            <Link href={ROUTES.dashboard.security} className="text-[11px] font-semibold text-primary underline-offset-2 hover:underline">
              {t('changePlatformPassword')}
            </Link>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{t('platformLoginBody')}</p>
        </div>
        <div className="rounded border border-border/70 bg-muted/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
              <p className="text-[12px] font-medium">{t('tradingPasswordTitle')}</p>
            </div>
            <ForexPortalStatusBadge tone={state?.tradingAvailable ? 'success' : 'warning'}>
              {state?.tradingAvailable ? t('availableBadge') : t('unavailableBadge')}
            </ForexPortalStatusBadge>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {state?.tradingAvailable
              ? t('requestBody')
              : state?.tradingReason
                ? t('credentialReason', { reason: state.tradingReason })
                : t('tradingPasswordBody')}
          </p>
          {state?.tradingAvailable ? (
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void request('TRADING')}
              className="mt-2 inline-flex min-h-9 items-center rounded border border-primary/40 bg-primary/10 px-3 text-[11px] font-semibold text-primary disabled:opacity-50"
            >
              {busy === 'TRADING' ? t('requesting') : t('requestTrading')}
            </button>
          ) : null}
        </div>
        <div className="rounded border border-border/50 bg-muted/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
              <p className="text-[12px] font-medium">{t('investorPasswordTitle')}</p>
            </div>
            <ForexPortalStatusBadge tone={state?.investorAvailable ? 'success' : 'warning'}>
              {state?.investorAvailable ? t('availableBadge') : t('unavailableBadge')}
            </ForexPortalStatusBadge>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {state?.investorAvailable
              ? t('requestBody')
              : state?.investorReason
                ? t('credentialReason', { reason: state.investorReason })
                : t('investorPasswordBody')}
          </p>
          {state?.investorAvailable ? (
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void request('INVESTOR')}
              className="mt-2 inline-flex min-h-9 items-center rounded border border-primary/40 bg-primary/10 px-3 text-[11px] font-semibold text-primary disabled:opacity-50"
            >
              {busy === 'INVESTOR' ? t('requesting') : t('requestInvestor')}
            </button>
          ) : null}
        </div>
        {err ? <p className="text-sm text-sell">{err}</p> : null}
        {note ? <p className="text-sm text-buy">{note}</p> : null}
      </div>
    </ForexPortalModuleCard>
  );
}
