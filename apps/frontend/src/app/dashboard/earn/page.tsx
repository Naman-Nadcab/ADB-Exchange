'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PiggyBank, ShieldCheck, Clock3, WalletCards } from 'lucide-react';

export default function EarnPage() {
  const te = useTranslations('account.earn');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <PiggyBank className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{te('title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {te('subtitle')}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            {te('badge')}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <WalletCards className="h-4 w-4 text-primary" />
              {te('cards.flexibleVaults.title')}
            </div>
            <p className="text-xs text-muted-foreground">{te('cards.flexibleVaults.desc')}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {te('cards.protectedControls.title')}
            </div>
            <p className="text-xs text-muted-foreground">{te('cards.protectedControls.desc')}</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock3 className="h-4 w-4 text-primary" />
              {te('cards.phasedRelease.title')}
            </div>
            <p className="text-xs text-muted-foreground">{te('cards.phasedRelease.desc')}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href="/wallet/convert"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
          >
            {te('exploreConvert')}
          </Link>
          <Link
            href="/dashboard/announcements"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {te('trackUpdates')}
          </Link>
        </div>
      </div>
    </div>
  );
}
