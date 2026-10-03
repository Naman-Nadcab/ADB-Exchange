'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAuthStore } from '@/store/auth';

/**
 * Protected layout wrapper: never full-screen infinite spinner.
 * Unauthenticated users redirect to login. The httpOnly session is revoked only by an explicit logout.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth.requireAuth');
  const pathname = usePathname();
  const router = useRouter();
  const { authResolved, isAuthenticated } = useAuth();
  const user = useAuthStore((s) => s.user);
  const status = user?.status;
  const redirectDone = useRef(false);
  const [redirecting, setRedirecting] = useState(false);

  const loginHref = pathname ? `/login?returnUrl=${encodeURIComponent(pathname)}` : '/login';

  useEffect(() => {
    if (!authResolved || isAuthenticated) return;
    if (redirectDone.current) return;
    redirectDone.current = true;
    setRedirecting(true);
    useAuthStore.getState().clearAuthState();
    router.replace(loginHref);
  }, [authResolved, isAuthenticated, loginHref, router]);

  if (!authResolved || redirecting || !isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center dark:bg-background">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground shadow-sm backdrop-blur-[1px]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
          {!authResolved ? t('checkingSession') : t('redirectingSignIn')}
        </div>
      </div>
    );
  }

  if (status && status !== 'active') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-muted p-6 text-center dark:bg-background">
        <p className="text-base font-semibold text-foreground">{t('restrictedTitle')}</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {t('restrictedBodyPrefix')} <span className="font-medium">{status}</span>. {t('restrictedBodySuffix')}
        </p>
        <div className="flex items-center gap-3">
          <a href="/dashboard/support" className="text-sm font-medium text-primary underline dark:text-blue-400">
            {t('contactSupport')}
          </a>
          <a href="/login" className="text-sm font-medium text-primary underline dark:text-blue-400">
            {t('signInOther')}
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
