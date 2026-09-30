'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { handleAppleCallback, consumeOAuthRedirect, resolvePostLoginRedirect } from '@/lib/oauth';
import { useAuthStore, type User } from '@/store/auth';
import { useAuth } from '@/context/AuthContext';
import { COOKIE_SESSION_MARKER } from '@/lib/authSession';

export default function AppleCallbackPage() {
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const { setAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const idToken = searchParams.get('id_token');
    const state = searchParams.get('state');
    const user = searchParams.get('user');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('Apple login was cancelled or failed');
      setTimeout(() => { window.location.assign('/login'); }, 3000);
      return;
    }

    if (!code || !state) {
      setError('Invalid callback parameters');
      setTimeout(() => { window.location.assign('/login'); }, 3000);
      return;
    }

    handleAppleCallback(code, idToken || '', state, user || undefined)
      .then((result) => {
        if (result.success && result.data) {
          const userData: User = {
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
            userData,
            result.data.accessToken ?? COOKIE_SESSION_MARKER,
            result.data.refreshToken ?? COOKIE_SESSION_MARKER,
          );
          setAuthenticated(userData);
          window.location.assign(resolvePostLoginRedirect(consumeOAuthRedirect()));
        } else {
          setError(result.error?.message || 'Apple login failed');
          setTimeout(() => { window.location.assign('/login'); }, 3000);
        }
      })
      .catch(() => {
        setError('An error occurred during login');
        setTimeout(() => { window.location.assign('/login'); }, 3000);
      });
  }, [searchParams, login, setAuthenticated]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        {error ? (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
              <span className="text-destructive text-2xl">!</span>
            </div>
            <p className="text-foreground text-lg">{error}</p>
            <p className="text-muted-foreground text-sm">Redirecting to login...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <p className="text-foreground text-lg">Completing Apple sign in...</p>
          </div>
        )}
      </div>
    </div>
  );
}
