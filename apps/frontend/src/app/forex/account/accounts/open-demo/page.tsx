'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { createForexDemoAccountAndActivate, syncForexAccountsFromServer } from '@/lib/forex/runtime/hydrate';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useAuthStore } from '@/store/auth';

type GroupChoice = { groupId: string; code: string; label: string; leverage: string; positionMode: string };

export default function ForexOpenDemoAccountPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.openDemo');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupChoice[]>([]);
  const [groupCode, setGroupCode] = useState('STANDARD');

  useEffect(() => {
    if (!authed) return;
    void forexApi.accountGroups().then((raw) => {
      const res = unwrap(raw);
      if (!res.ok) return;
      const list = res.data.groups ?? [];
      setGroups(list);
      if (list[0] && !list.some((g) => g.code === 'STANDARD')) setGroupCode(list[0].code);
    });
  }, [authed]);

  async function onCreate() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const ok = await createForexDemoAccountAndActivate(groupCode);
      if (!ok) {
        setErr(t('failed'));
        return;
      }
      await syncForexAccountsFromServer();
      setCreatedId(t('successGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ForexPageFrame title={tf('pages.openDemo.title')} subtitle={tf('pages.openDemo.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href={`/login?redirect=${FOREX_ROUTES.openDemoAccount}`} sectionKey="forexAccounts" />
      ) : (
        <ForexPortalModuleCard title={t('flowTitle')} accent>
          <ForexPortalStatusBadge tone="primary">{t('demoBadge')}</ForexPortalStatusBadge>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[12px] text-muted-foreground">
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
          </ol>
          <p className="mt-3 text-[12px] text-foreground">{t('simulatedNotice')}</p>
          {groups.length > 0 ? (
            <fieldset className="mt-4 space-y-2">
              <legend className="text-[12px] font-medium">{t('groupLegend')}</legend>
              {groups.map((g) => (
                <label key={g.groupId} className="flex cursor-pointer items-start gap-2 rounded border border-border px-3 py-2 text-[12px]">
                  <input
                    type="radio"
                    name="forex-group"
                    className="mt-0.5"
                    checked={groupCode === g.code}
                    onChange={() => setGroupCode(g.code)}
                  />
                  <span>
                    <span className="font-medium">{g.label}</span>
                    <span className="mt-0.5 block text-muted-foreground">
                      {g.code} · 1:{g.leverage} · {g.positionMode}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreate()}
              className="rounded border border-primary/45 bg-primary/12 px-4 py-2 text-[12px] font-semibold text-primary disabled:opacity-50"
            >
              {busy ? t('creating') : t('createCta')}
            </button>
            <Link href={FOREX_ROUTES.accounts} className="rounded border border-border px-4 py-2 text-[12px] font-semibold">
              {t('backAccounts')}
            </Link>
          </div>
          {createdId ? <p className="mt-3 text-sm text-buy">{t('success')}</p> : null}
          {err ? <p className="mt-3 text-sm text-sell">{err}</p> : null}
        </ForexPortalModuleCard>
      )}
    </ForexPageFrame>
  );
}
