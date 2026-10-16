'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ForexPortalStatusBadge } from './ForexPortalKpiCard';
import { fxPlain } from './format';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { useForexSession } from '@/lib/forex/runtime/useForexSession';
import { useForexStore } from '@/lib/forex/state/store';

/** Compact active-account strip for account-scoped portal pages. */
export function ForexPortalAccountContext() {
  const t = useTranslations('forex.portalAccountContext');
  const authed = useForexSession().authed;
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const account = useForexStore((s) => s.account);
  const forexAccounts = useForexStore((s) => s.forexAccounts);
  const meta = forexAccounts.find((a) => a.accountId === (account?.accountId ?? activeId)) ?? forexAccounts[0];

  if (!authed || !activeId) return null;

  const kindUpper = String(meta?.accountKind ?? '').toUpperCase();
  const kindLabel =
    kindUpper === 'DEMO' ? t('kindDemo') : kindUpper === 'LIVE' || kindUpper === 'REAL' ? t('kindLive') : fxPlain(meta?.accountKind);

  const accountRef = fxPlain(activeId);
  const shortRef = accountRef.length > 8 ? `${accountRef.slice(0, 8)}…` : accountRef;

  return (
    <section
      className="forex-portal-context flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
      aria-label={t('aria')}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ForexPortalStatusBadge tone={kindUpper === 'DEMO' ? 'primary' : 'neutral'}>{kindLabel}</ForexPortalStatusBadge>
        <p className="min-w-0 truncate text-[13px] font-medium text-foreground">
          {fxPlain(meta?.currency)}
          <span className="ml-2 font-mono text-[12px] font-normal text-muted-foreground" title={accountRef}>
            #{shortRef}
          </span>
        </p>
      </div>
      {activeId ? (
        <Link
          href={FOREX_ROUTES.accountDetail(activeId)}
          className="shrink-0 text-[13px] font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('viewDetail')}
        </Link>
      ) : null}
    </section>
  );
}
