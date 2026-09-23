'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LayoutGrid } from 'lucide-react';
import { ForexAccountSwitcher } from './ForexAccountSwitcher';
import { ForexPortalStatusBadge } from './ForexPortalKpiCard';
import { fxPlain } from './format';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';
import { useAuthStore } from '@/store/auth';

/** Compact active-account strip for account-scoped portal pages. */
export function ForexPortalAccountContext() {
  const t = useTranslations('forex.portalAccountContext');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const activeId = useForexStore((s) => s.activeForexAccountId);
  const account = useForexStore((s) => s.account);
  const forexAccounts = useForexStore((s) => s.forexAccounts);
  const meta = forexAccounts.find((a) => a.accountId === (account?.accountId ?? activeId)) ?? forexAccounts[0];

  if (!authed || !activeId) return null;

  const kindUpper = String(meta?.accountKind ?? '').toUpperCase();
  const kindLabel =
    kindUpper === 'DEMO' ? t('kindDemo') : kindUpper === 'LIVE' || kindUpper === 'REAL' ? t('kindLive') : fxPlain(meta?.accountKind);

  return (
    <section
      className="eda-card flex flex-wrap items-center justify-between gap-2 border-border/80 bg-muted/10 px-3 py-2"
      aria-label={t('aria')}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ForexPortalStatusBadge tone={kindUpper === 'DEMO' ? 'primary' : 'neutral'}>{kindLabel}</ForexPortalStatusBadge>
        <ForexAccountSwitcher compact />
        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
          {fxPlain(meta?.currency)} · {fxPlain(activeId)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {activeId ? (
          <Link
            href={FOREX_ROUTES.accountDetail(activeId)}
            className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
          >
            {t('viewDetail')}
          </Link>
        ) : null}
        <Link
          href={FOREX_ROUTES.trade}
          className="inline-flex items-center gap-1 rounded border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary"
        >
          <LayoutGrid className="h-3 w-3" aria-hidden />
          {t('openTerminal')}
        </Link>
      </div>
    </section>
  );
}
