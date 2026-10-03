'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ROUTES } from '@/lib/routes';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from './ForexPortalKpiCard';
import { useForexProductGates } from '@/lib/forex/hooks/useForexProductGates';
import { useForexLiveKycPolicy } from '@/lib/forex/hooks/useForexLiveKycPolicy';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

export function ForexCustomerGuidanceBanner() {
  const t = useTranslations('forex.customerGuidance');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const accounts = useForexStore((s) => s.forexAccounts);
  const account = useForexStore((s) => s.account);
  const balance = useForexStore((s) => s.balance);
  const { gates } = useForexProductGates();
  const kycPolicy = useForexLiveKycPolicy();

  if (!authed) return null;

  const ledger = Number(account?.ledgerBalance ?? balance?.ledgerBalance ?? 0);
  const needsDemo = Number.isFinite(ledger) && ledger <= 0;
  const hasAccounts = accounts.length > 0;
  const items: Array<{ key: string; tone: 'success' | 'warning' | 'neutral'; title: string; body: string; href?: string; cta?: string }> =
    [];

  if (!hasAccounts) {
    items.push({
      key: 'no-account',
      tone: 'warning',
      title: t('noAccountTitle'),
      body: t('noAccountBody'),
      href: FOREX_ROUTES.accounts,
      cta: t('noAccountCta'),
    });
  }

  if (needsDemo && hasAccounts) {
    items.push({
      key: 'demo-funds',
      tone: 'warning',
      title: t('demoFundsTitle'),
      body: t('demoFundsBody'),
      href: FOREX_ROUTES.funds,
      cta: t('demoFundsCta'),
    });
  }

  if (!gates.liveAccountEnabled) {
    items.push({
      key: 'live-off',
      tone: 'neutral',
      title: t('liveUnavailableTitle'),
      body: t('liveUnavailableBody'),
    });
  } else if (kycPolicy.kycRequired && !kycPolicy.kycVerified && !kycPolicy.loading) {
    items.push({
      key: 'kyc',
      tone: 'warning',
      title: t('kycRequiredTitle'),
      body: t('kycRequiredBody'),
      href: ROUTES.dashboard.identity,
      cta: t('kycRequiredCta'),
    });
  }

  if (items.length === 0) {
    return (
      <ForexPortalModuleCard title={t('allSetTitle')} accent>
        <ForexPortalStatusBadge tone="success">{t('allSetBadge')}</ForexPortalStatusBadge>
        <p className="mt-2 text-sm text-muted-foreground">{t('allSetBody')}</p>
      </ForexPortalModuleCard>
    );
  }

  return (
    <ForexPortalModuleCard title={t('checklistTitle')} subtitle={t('checklistSubtitle')} accent>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.key} className="rounded border border-border/70 bg-muted/10 px-3 py-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <ForexPortalStatusBadge tone={item.tone === 'success' ? 'success' : item.tone === 'warning' ? 'warning' : 'neutral'}>
                  {item.title}
                </ForexPortalStatusBadge>
                <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{item.body}</p>
              </div>
              {item.href && item.cta ? (
                <Link
                  href={item.href}
                  className="shrink-0 rounded border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary"
                >
                  {item.cta}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </ForexPortalModuleCard>
  );
}
