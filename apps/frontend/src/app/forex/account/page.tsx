'use client';

import { useTranslations } from 'next-intl';
import { ForexAccountOverviewDashboard } from '@/components/forex/ForexAccountOverviewDashboard';
import { ForexPageFrame, ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

export default function ForexAccountPage() {
  const tf = useTranslations('forex');
  const t = useTranslations('forex.accountPage');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);

  return (
    <ForexPageFrame title={tf('pages.account.title')} subtitle={tf('pages.account.subtitle')}>
      {!authed ? (
        <ForexSignInPrompt href="/login?redirect=/forex/account" sectionKey="yourForexAccount" />
      ) : !account && !balance ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <ForexAccountOverviewDashboard />
      )}
    </ForexPageFrame>
  );
}
