'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { FOREX_ROUTES } from '@/lib/forex/routes';

export default function ForexSignalsPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.signalsPage');

  return (
    <ForexPageFrame title={tf('pages.signals.title')} subtitle={tf('pages.signals.subtitle')}>
      <ForexPortalModuleCard title={t('flowTitle')} accent>
        <ol className="list-decimal space-y-2 pl-5 text-[12px] leading-relaxed text-muted-foreground">
          <li>{t('step1')}</li>
          <li>{t('step2')}</li>
          <li>{t('step3')}</li>
        </ol>
        <Link href={FOREX_ROUTES.trade} className="mt-3 inline-block text-[12px] font-semibold text-primary underline-offset-2 hover:underline">
          {t('goTrade')}
        </Link>
      </ForexPortalModuleCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <ForexPortalModuleCard title={t('listTitle')} subtitle={t('listSubtitle')}>
          <ForexPortalStatusBadge tone="warning">{t('noneYet')}</ForexPortalStatusBadge>
          <p className="mt-3 text-sm text-muted-foreground">{t('listEmpty')}</p>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard title={t('settingsTitle')}>
          <p className="text-[12px] leading-relaxed text-muted-foreground">{t('settingsLead')}</p>
          <form className="mt-3 max-w-md space-y-3" onSubmit={(e) => e.preventDefault()}>
            <label className="block text-[11px]">
              <span className="text-muted-foreground">{t('depositPct')}</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
                inputMode="decimal"
                disabled
                value=""
                readOnly
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-muted-foreground">{t('equityStop')}</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
                inputMode="decimal"
                disabled
                value=""
                readOnly
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-muted-foreground">{t('slippage')}</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
                inputMode="decimal"
                disabled
                value=""
                readOnly
              />
            </label>
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <input type="checkbox" disabled />
              {t('copySlTp')}
            </label>
            <button
              type="submit"
              disabled
              className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t('subscribe')}
            </button>
          </form>
        </ForexPortalModuleCard>
      </div>
    </ForexPageFrame>
  );
}
