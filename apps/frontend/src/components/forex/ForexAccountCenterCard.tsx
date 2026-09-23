'use client';

import Link from 'next/link';
import { LayoutGrid, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { fxMoney, fxPlain } from '@/components/forex/format';
import { ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import type { ForexAccountCardSnapshot, ForexCustomerAccountSummary } from '@/lib/forex/api/client';
import { FOREX_ROUTES } from '@/lib/forex/routes';
import { cn } from '@/lib/utils';

type AccountRow = ForexCustomerAccountSummary & { cardSnapshot?: ForexAccountCardSnapshot };

export function ForexAccountCenterCard(props: {
  account: AccountRow;
  isActive: boolean;
  busy: string | null;
  kindLabel: (kind: string) => string;
  onSwitch: (accountId: string) => void;
}) {
  const t = useTranslations('forex.accountCenter');
  const tu = useTranslations('forex.riskStates');
  const { account: a, isActive, busy, kindLabel, onSwitch } = props;

  const kind = a.accountKind.toUpperCase();
  const lev = a.leverageOverride ? String(a.leverageOverride) : t('leverageUnavailable');
  const snap = a.cardSnapshot?.financialSnapshot;
  const cardCurrency = snap?.currency ?? a.currency;
  const unavailable = tu('unavailable');
  const detailHref = FOREX_ROUTES.accountDetail(a.accountId);
  const groupLabel = a.groupLabel?.trim() ? fxPlain(a.groupLabel) : t('groupDefault');

  return (
    <article
      className={cn(
        'flex flex-col rounded-lg border p-3.5 shadow-sm',
        isActive ? 'border-primary/40 bg-gradient-to-br from-card via-card to-primary/[0.08]' : 'border-border/80 bg-card/85'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <ForexPortalStatusBadge tone={kind === 'DEMO' ? 'primary' : 'neutral'}>{kindLabel(a.accountKind)}</ForexPortalStatusBadge>
            <ForexPortalStatusBadge tone={String(a.status).toUpperCase() === 'ACTIVE' ? 'success' : 'neutral'}>
              {fxPlain(a.status)}
            </ForexPortalStatusBadge>
            {isActive ? (
              <ForexPortalStatusBadge tone="success">{t('activeBadge')}</ForexPortalStatusBadge>
            ) : null}
          </div>
          <p className="text-[13px] font-semibold text-foreground">{fxPlain(a.label)}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {t('cardTradingLogin')}: {fxPlain(a.accountId)}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-[11px] sm:grid-cols-2">
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{t('colAccountId')}</dt>
          <dd className="mt-0.5 font-mono font-medium">{fxPlain(a.accountId)}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{t('cardServer')}</dt>
          <dd className="mt-0.5">{t('cardServerSimulated')}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{t('cardAccountGroup')}</dt>
          <dd className="mt-0.5">{groupLabel}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{t('colCurrency')}</dt>
          <dd className="mt-0.5">{fxPlain(a.currency)}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{t('cardPositionMode')}</dt>
          <dd className="mt-0.5">{fxPlain(a.positionMode)}</dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{t('colLeverage')}</dt>
          <dd className="mt-0.5 font-mono">{lev}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{t('cardCreated')}</dt>
          <dd className="mt-0.5 text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</dd>
        </div>
      </dl>

      {snap ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 font-mono text-[11px] xl:grid-cols-3">
          <div>
            <dt className="text-[9px] uppercase text-muted-foreground">{t('metricBalance')}</dt>
            <dd className="mt-0.5 tabular-nums">{fxMoney(snap.ledgerBalance, cardCurrency)}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase text-muted-foreground">{t('metricEquity')}</dt>
            <dd className="mt-0.5 tabular-nums">{fxMoney(snap.equity, cardCurrency)}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase text-muted-foreground">{t('metricMargin')}</dt>
            <dd className="mt-0.5 tabular-nums">{fxMoney(snap.usedMargin, cardCurrency)}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase text-muted-foreground">{t('metricFreeMargin')}</dt>
            <dd className="mt-0.5 tabular-nums">{fxMoney(snap.freeMargin, cardCurrency)}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase text-muted-foreground">{t('metricMarginLevel')}</dt>
            <dd className="mt-0.5 tabular-nums">{snap.marginLevel != null && snap.marginLevel !== '' ? `${snap.marginLevel}%` : unavailable}</dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase text-muted-foreground">{t('cardOpenPositions')}</dt>
            <dd className="mt-0.5 tabular-nums">{a.cardSnapshot?.activitySummary.openPositions ?? '—'}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">{t('metricsUnavailable')}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Link
          href={detailHref}
          className="inline-flex min-h-8 items-center rounded border border-primary/40 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/15"
        >
          {t('viewDetail')}
        </Link>
        <Link
          href={detailHref}
          className="inline-flex min-h-8 items-center gap-1 rounded border border-border px-2.5 text-[11px] font-medium hover:border-primary/40"
        >
          <Settings2 className="h-3 w-3" aria-hidden />
          {t('manage')}
        </Link>
        {isActive ? (
          <span className="inline-flex min-h-8 items-center px-2 text-[11px] text-muted-foreground">{t('current')}</span>
        ) : (
          <button
            type="button"
            disabled={busy != null}
            onClick={() => onSwitch(a.accountId)}
            className="inline-flex min-h-8 items-center rounded border border-border px-2.5 text-[11px] font-medium hover:border-primary/40 disabled:opacity-50"
          >
            {busy === a.accountId ? t('switching') : t('switch')}
          </button>
        )}
        <Link
          href={FOREX_ROUTES.trade}
          className="inline-flex min-h-8 items-center gap-1 rounded border border-border px-2.5 text-[11px] font-medium hover:border-primary/40"
        >
          <LayoutGrid className="h-3 w-3" aria-hidden />
          {t('openTradeTerminal')}
        </Link>
        {kind === 'DEMO' ? (
          <Link
            href={FOREX_ROUTES.funds}
            className="inline-flex min-h-8 items-center rounded border border-border/70 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {t('demoFundingShort')}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
