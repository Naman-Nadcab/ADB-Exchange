'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function ForexPageFrame(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean;
  /** Compact commercial header — less vertical chrome */
  dense?: boolean;
}) {
  const tf = useTranslations('forex');
  const dense = props.dense !== false;
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1480px]',
        dense ? 'space-y-3 px-3 py-3 sm:px-4' : 'space-y-5 px-4 py-6 sm:px-6',
        props.className
      )}
    >
      <div className={cn('flex flex-wrap items-center justify-between gap-2', !dense && 'items-end gap-3')}>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{tf('domainLabel')}</p>
          <h1
            className={cn(
              'font-semibold uppercase tracking-[0.08em] text-foreground',
              dense ? 'text-[13px]' : 'text-2xl normal-case tracking-tight'
            )}
          >
            {props.title}
          </h1>
          {props.subtitle ? (
            <p className={cn('max-w-2xl text-muted-foreground', dense ? 'mt-0.5 text-[11px]' : 'mt-1 text-sm')}>
              {props.subtitle}
            </p>
          ) : null}
        </div>
        {props.actions}
      </div>
      {props.children}
    </div>
  );
}

export type ForexSignInSectionKey =
  | 'ledger'
  | 'orders'
  | 'portfolio'
  | 'yourForexAccount'
  | 'funds'
  | 'forexAccounts';

export function ForexSignInPrompt({
  href,
  sectionKey,
}: {
  href: string;
  sectionKey: ForexSignInSectionKey;
}) {
  const tf = useTranslations('forex');
  const section = tf(`signIn.sections.${sectionKey}`);
  return (
    <div className="eda-card flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-card px-4 py-3">
      <p className="text-sm text-foreground">{tf('signIn.prompt', { section })}</p>
      <Link
        href={href}
        className="inline-flex min-h-9 items-center rounded bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        {tf('signIn.link')}
      </Link>
    </div>
  );
}
