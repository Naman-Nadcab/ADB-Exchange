'use client';

import { useTranslations } from 'next-intl';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';

export default function ForexSignalsPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.signalsPage');

  return (
    <ForexPageFrame title={tf('pages.signals.title')} subtitle={tf('pages.signals.subtitle')}>
      <div className="grid gap-3 lg:grid-cols-2">
        <ForexPortalModuleCard title={t('listTitle')} subtitle={t('listSubtitle')} accent>
          <ForexPortalStatusBadge tone="warning">{t('notConnected')}</ForexPortalStatusBadge>
          <p className="mt-3 text-sm text-muted-foreground">{t('listEmpty')}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t('listBody')}</p>
        </ForexPortalModuleCard>

        <ForexPortalModuleCard title={t('settingsTitle')} subtitle={t('settingsSubtitle')}>
          <form className="max-w-md space-y-3" onSubmit={(e) => e.preventDefault()}>
            <label className="block text-[11px]">
              <span className="text-muted-foreground">{t('depositPct')}</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
                inputMode="decimal"
                disabled
                placeholder="95"
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-muted-foreground">{t('equityStop')}</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
                inputMode="decimal"
                disabled
              />
            </label>
            <label className="block text-[11px]">
              <span className="text-muted-foreground">{t('slippage')}</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 font-mono text-[12px] disabled:opacity-60"
                inputMode="decimal"
                disabled
                placeholder="0.5"
              />
            </label>
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <input type="checkbox" defaultChecked disabled />
              {t('copySlTp')}
            </label>
            <p className="text-[12px] text-muted-foreground">{t('locked')}</p>
            <button
              type="submit"
              disabled
              className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {t('subscribe')}
            </button>
          </form>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{t('positionsNote')}</p>
        </ForexPortalModuleCard>
      </div>
    </ForexPageFrame>
  );
}
