'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { resolvePostLoginRedirect } from '@/lib/oauth';

export default function GuestOnly({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const { authResolved, isAuthenticated, user } = useAuth();
  const t = useTranslations('auth.requireAuth');
  const redirectDone = useRef(false);
  const signedIn = authResolved && isAuthenticated && user != null;

  useEffect(() => {
    if (!signedIn) return;
    if (redirectDone.current) return;
    redirectDone.current = true;
    const target = resolvePostLoginRedirect(
      searchParams.get('returnUrl'),
      searchParams.get('redirect'),
    );
    window.location.assign(target);
  }, [signedIn, searchParams]);

  if (!signedIn) return <>{children}</>;

  return (
    <div className="flex min-h-[30vh] items-center justify-center bg-muted/40 p-6 dark:bg-background">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground shadow-sm backdrop-blur-[1px]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
        {t('openingApp')}
      </div>
    </div>
  );
}
