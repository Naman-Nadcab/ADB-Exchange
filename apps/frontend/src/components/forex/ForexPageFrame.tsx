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
  /** Overview already has its own hero. Other portal pages use the shared hero. */
  header?: 'hero' | 'compact' | 'none';
}) {
  const tf = useTranslations('forex');
  const dense = props.dense !== false;
  const hero = props.header !== 'compact' && props.header !== 'none';
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1480px]',
        hero ? 'space-y-4 px-3 py-4 sm:px-4 sm:py-5' : dense ? 'space-y-3 px-3 py-3 sm:px-4' : 'space-y-5 px-4 py-6 sm:px-6',
        props.className
      )}
    >
      {props.header === 'none' ? null : hero ? (
        <header className="forex-portal-hero flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="text-[15px] font-semibold tracking-tight text-foreground">{props.title}</h1>
            {props.subtitle ? <p className="min-w-0 text-[12px] leading-snug text-muted-foreground">{props.subtitle}</p> : null}
          </div>
          {props.actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{props.actions}</div> : null}
        </header>
      ) : (
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
              <p className={cn('max-w-2xl text-muted-foreground', dense ? 'mt-0.5 text-[11px]' : 'mt-1 text-sm')}>{props.subtitle}</p>
            ) : null}
          </div>
          {props.actions}
        </div>
      )}
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
  | 'forexAccounts'
  | 'tradeHistory'
  | 'partner';

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
    <div className="eda-card flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-card px-4 py-4">
      <p className="text-sm text-foreground">{tf('signIn.prompt', { section })}</p>
      <Link
        href={href}
        className="inline-flex min-h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        {tf('signIn.link')}
      </Link>
    </div>
  );
}
