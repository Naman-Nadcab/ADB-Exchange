'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { handleGoogleCallback, consumeOAuthRedirect, resolvePostLoginRedirect } from '@/lib/oauth';
import { useAuthStore, type User } from '@/store/auth';
import { useAuth } from '@/context/AuthContext';
import { COOKIE_SESSION_MARKER } from '@/lib/authSession';

export default function GoogleCallbackPage() {
  const t = useTranslations('auth.oauthCallback');
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const { setAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(t('googleCancelled'));
      setTimeout(() => { window.location.assign('/login'); }, 3000);
      return;
    }

    if (!code || !state) {
      setError(t('invalidParams'));
      setTimeout(() => { window.location.assign('/login'); }, 3000);
      return;
    }

    handleGoogleCallback(code, state)
      .then((result) => {
        if (result.success && result.data) {
          const user: User = {
            id: result.data.user.id,
            email: result.data.user.email,
            phone: result.data.user.phone,
            username: result.data.user.username,
            status: result.data.user.status as User['status'],
            emailVerified: result.data.user.emailVerified,
            phoneVerified: result.data.user.phoneVerified,
            tierLevel: result.data.user.tierLevel,
          };
          login(
            user,
            result.data.accessToken ?? COOKIE_SESSION_MARKER,
            result.data.refreshToken ?? COOKIE_SESSION_MARKER,
          );
          setAuthenticated(user);
          window.location.assign(resolvePostLoginRedirect(consumeOAuthRedirect()));
        } else {
          setError(result.error?.message || t('googleFailed'));
          setTimeout(() => { window.location.assign('/login'); }, 3000);
        }
      })
      .catch(() => {
        setError(t('loginError'));
        setTimeout(() => { window.location.assign('/login'); }, 3000);
      });
  }, [searchParams, login, setAuthenticated, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        {error ? (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
              <span className="text-destructive text-2xl">!</span>
            </div>
            <p className="text-foreground text-lg">{error}</p>
            <p className="text-muted-foreground text-sm">{t('redirectingToLogin')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <p className="text-foreground text-lg">{t('completingGoogle')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
