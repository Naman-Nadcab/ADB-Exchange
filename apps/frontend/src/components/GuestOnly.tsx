'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resolvePostLoginRedirect } from '@/lib/oauth';

export default function GuestOnly({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const { authResolved, isAuthenticated } = useAuth();
  const redirectDone = useRef(false);

  useEffect(() => {
    if (!authResolved || !isAuthenticated) return;
    if (redirectDone.current) return;
    redirectDone.current = true;
    const target = resolvePostLoginRedirect(
      searchParams.get('returnUrl'),
      searchParams.get('redirect'),
    );
    window.location.assign(target);
  }, [authResolved, isAuthenticated, searchParams]);

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
