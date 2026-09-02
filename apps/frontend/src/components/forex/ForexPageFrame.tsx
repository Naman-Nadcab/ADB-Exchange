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
}) {
  return (
    <div className={cn(props.wide ? 'mx-auto max-w-[1400px]' : 'mx-auto max-w-6xl', 'space-y-5 px-4 py-6 sm:px-6', props.className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
          {props.subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{props.subtitle}</p> : null}
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
