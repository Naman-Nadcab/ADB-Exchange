'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard } from '@/components/forex/ForexPortalKpiCard';
import { ForexServerAlertsPanel } from '@/components/forex/ForexServerAlertsPanel';
import { FOREX_ROUTES } from '@/lib/forex/routes';

export default function ForexAlertsPage() {
  const tf = useTranslations('forex');
  const ta = useTranslations('forex.alertsPage');
  return (
    <ForexPageFrame title={tf('pages.alerts.title')} subtitle={tf('pages.alerts.subtitle')} wide>
      <div className="mx-auto max-w-4xl space-y-3">
        <ForexPortalModuleCard title={tf('pages.alerts.title')} subtitle={ta('intro')}>
          <p className="text-[12px] text-muted-foreground">
            {ta('manageHere')}{' '}
            <Link href={FOREX_ROUTES.trade} className="text-primary underline underline-offset-2">
              {ta('tradeTerminal')}
            </Link>
            {ta('manageSuffix')}
          </p>
        </ForexPortalModuleCard>

        <ForexServerAlertsPanel />

        <ForexPortalModuleCard title={ta('localOnlyTitle')} subtitle={ta('localOnlyBadge')}>
          <p className="text-[12px] leading-relaxed text-muted-foreground">{ta('localOnlyBody')}</p>
        </ForexPortalModuleCard>
      </div>
    </ForexPageFrame>
  );
}
