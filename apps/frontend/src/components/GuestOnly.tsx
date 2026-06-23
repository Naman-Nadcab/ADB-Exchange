'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function GuestOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authResolved, isAuthenticated } = useAuth();
  const redirectDone = useRef(false);

  useEffect(() => {
    if (!authResolved || !isAuthenticated) return;
    if (redirectDone.current) return;
    redirectDone.current = true;
    const redirect = searchParams.get('redirect');
    const allowed =
      redirect &&
      (redirect.startsWith('/dashboard') ||
        redirect.startsWith('/trade') ||
        redirect.startsWith('/markets') ||
        redirect.startsWith('/wallet') ||
        redirect.startsWith('/p2p') ||
        redirect.startsWith('/orders') ||
        redirect.startsWith('/earn'));
    const target = allowed ? redirect! : '/dashboard';
    router.replace(target);
  }, [authResolved, isAuthenticated, router, searchParams]);

  if (!authResolved) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center bg-muted/40 p-6 dark:bg-background">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground shadow-sm backdrop-blur-[1px]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Checking your session…
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center bg-muted/40 p-6 dark:bg-background">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground shadow-sm backdrop-blur-[1px]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          Taking you to the app…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
