import type { ReactNode } from 'react';
import Link from 'next/link';
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
  return (
    <div
      className={cn(
        props.wide ? 'mx-auto max-w-[1400px]' : 'mx-auto max-w-6xl',
        props.dense ? 'space-y-3 px-3 py-3 sm:px-4' : 'space-y-5 px-4 py-6 sm:px-6',
        props.className
      )}
    >
      <div className={cn('flex flex-wrap items-center justify-between', props.dense ? 'gap-2' : 'items-end gap-3')}>
        <div className="min-w-0">
          <h1 className={cn('font-semibold tracking-tight', props.dense ? 'text-lg' : 'text-2xl')}>{props.title}</h1>
          {props.subtitle && !props.dense ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{props.subtitle}</p>
          ) : null}
        </div>
        {props.actions}
      </div>
      {props.children}
    </div>
  );
}

export function ForexSignInPrompt({ href, label }: { href: string; label: string }) {
  return (
    <p className="eda-card p-4 text-sm text-muted-foreground">
      Sign in to view {label}.{' '}
      <Link href={href} className="text-primary underline underline-offset-2">
        Sign in
      </Link>
    </p>
  );
}
