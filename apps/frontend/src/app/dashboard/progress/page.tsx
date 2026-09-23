'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CheckCircle2,
  Circle,
  Loader2,
  ChevronRight,
  TrendingUp,
  Users,
  Key,
  FileText,
} from 'lucide-react';
import {
  EXCHANGE_PROGRESS_STEPS,
  type ProgressStep,
  type StepStatus,
} from '@/data/exchangeProgressSteps';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<ProgressStep['category'], React.ReactNode> = {
  spot_backend: <TrendingUp className="h-5 w-5" />,
  spot_frontend: <TrendingUp className="h-5 w-5" />,
  p2p_backend: <Users className="h-5 w-5" />,
  p2p_frontend: <Users className="h-5 w-5" />,
  general: <Key className="h-5 w-5" />,
};

function StepRow({ step }: { step: ProgressStep }) {
  const t = useTranslations('account.progressPage');
  const status = step.status;
  const statusLabel =
    status === 'done'
      ? t('statusDone')
      : status === 'in_progress'
        ? t('statusInProgress')
        : t('statusPending');

  const pillClass =
    status === 'done'
      ? 'bg-buy-light text-buy'
      : status === 'in_progress'
        ? 'bg-primary/10 text-primary'
        : 'bg-muted text-muted-foreground';

  const iconWrapClass =
    status === 'done'
      ? 'bg-buy-light text-buy ring-1 ring-buy/20'
      : status === 'in_progress'
        ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
        : 'bg-muted text-muted-foreground ring-1 ring-border';

  const icon =
    status === 'done' ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : status === 'in_progress' ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <Circle className="h-4 w-4" />
    );

  return (
    <div className="flex items-start gap-4 border-b border-border px-4 py-4 last:border-b-0 transition-colors hover:bg-muted/30">
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          iconWrapClass
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{t(`steps.${step.id}.title`)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t(`steps.${step.id}.description`)}</p>
        {step.routeOrLocation && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">{step.routeOrLocation}</p>
        )}
      </div>
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-medium',
          pillClass
        )}
      >
        {statusLabel}
      </span>
    </div>
  );
}

export default function ProgressPage() {
  const t = useTranslations('account.progressPage');

  const byCategory = useMemo(() => {
    const map = new Map<ProgressStep['category'], ProgressStep[]>();
    for (const step of EXCHANGE_PROGRESS_STEPS) {
      const list = map.get(step.category) ?? [];
      list.push(step);
      map.set(step.category, list);
    }
    const order: ProgressStep['category'][] = [
      'spot_backend',
      'spot_frontend',
      'p2p_backend',
      'p2p_frontend',
      'general',
    ];
    return order.map((cat) => ({ category: cat, steps: map.get(cat) ?? [] }));
  }, []);

  const counts = useMemo(() => {
    let done = 0;
    let inProgress = 0;
    let pending = 0;
    for (const step of EXCHANGE_PROGRESS_STEPS) {
      if (step.status === 'done') done++;
      else if (step.status === 'in_progress') inProgress++;
      else pending++;
    }
    return { done, inProgress, pending, total: EXCHANGE_PROGRESS_STEPS.length };
  }, []);

  const donePercent =
    counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{t('overallCompletion')}</span>
            <span className="tabular-nums text-muted-foreground">
              {t('stepsCount', {
                done: counts.done,
                total: counts.total,
                percent: donePercent,
              })}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-buy transition-[width] duration-500 ease-out"
              style={{ width: `${donePercent}%` }}
              role="progressbar"
              aria-valuenow={donePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('progressAria')}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-buy-light p-4 text-buy">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-2xl font-bold tabular-nums">{counts.done}</span>
            </div>
            <span className="text-sm font-medium">{t('statusDone')}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-primary/10 p-4 text-primary">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
              <span className="text-2xl font-bold tabular-nums">{counts.inProgress}</span>
            </div>
            <span className="text-sm font-medium">{t('statusInProgress')}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted p-4 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Circle className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-2xl font-bold tabular-nums text-foreground">{counts.pending}</span>
            </div>
            <span className="text-sm font-medium">{t('statusPending')}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-2xl font-bold tabular-nums text-foreground">{counts.total}</span>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{t('totalSteps')}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {byCategory.map(({ category, steps }) => (
          <section
            key={category}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
              <span className="text-primary">{CATEGORY_ICONS[category]}</span>
              <h2 className="font-semibold text-foreground">{t(`categories.${category}`)}</h2>
              <span className="ml-auto text-sm text-muted-foreground">
                {steps.filter((s) => s.status === 'done').length} / {steps.length}
              </span>
            </div>
            <div className="flex flex-col">
              {steps.map((step) => (
                <StepRow key={step.id} step={step} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-foreground transition-colors hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
          {t('backDashboard')}
        </Link>
        <Link
          href="/trade/spot"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/85"
        >
          {t('spotTrading')}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          href="/p2p"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/85"
        >
          {t('p2pTrading')}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
