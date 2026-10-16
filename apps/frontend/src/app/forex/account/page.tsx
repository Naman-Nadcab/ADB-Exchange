'use client';

import { useTranslations } from 'next-intl';
import { ForexAccountOverviewDashboard } from '@/components/forex/ForexAccountOverviewDashboard';
import { ForexCustomerGuidanceBanner } from '@/components/forex/ForexCustomerGuidanceBanner';
import { ForexAuthPending, ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { useForexStore } from '@/lib/forex/state/store';

export default function ForexAccountPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.accountPage');
  const session = useForexSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);

  return (
    <ForexPageFrame header="none" title={tf('pages.account.title')} subtitle={tf('pages.account.subtitle')}>
      {session.status !== 'AUTHENTICATED' ? (
        <ForexAuthPending status={session.status} href="/login?redirect=/forex/account" sectionKey="yourForexAccount" />
      ) : !account && !balance ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <>
          <ForexCustomerGuidanceBanner />
          <ForexAccountOverviewDashboard />
        </>
      )}
    </ForexPageFrame>
  );
}
