'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthStore, type User } from '@/store/auth';
import { COOKIE_SESSION_MARKER } from '@/lib/authSession';
import { useAuth } from '@/context/AuthContext';
import { consumeOAuthRedirect, resolvePostLoginRedirect } from '@/lib/oauth';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import { WalletAuthPanel } from '@/components/auth/WalletAuthPanel';
import { useTranslations } from 'next-intl';

function toUser(d: Record<string, unknown>): User {
  const hasEmail = d.email != null && String(d.email).length > 0;
  const hasPhone = d.phone != null && String(d.phone).length > 0;
  return {
    id: String(d.id ?? ''),
    email: d.email != null ? String(d.email) : null,
    phone: d.phone != null ? String(d.phone) : null,
    username: d.username != null ? String(d.username) : null,
    status: (d.status as User['status']) ?? 'active',
    emailVerified: Boolean(d.emailVerified ?? d.email_verified ?? hasEmail),
    phoneVerified: Boolean(d.phoneVerified ?? d.phone_verified ?? hasPhone),
    tierLevel: Number(d.tierLevel ?? d.tier_level ?? 0),
  };
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const { setAuthenticated } = useAuth();
  const t = useTranslations('auth.login');
  const tw = useTranslations('auth.wallet');

  useEffect(() => {
    const r = searchParams.get('redirect') || searchParams.get('returnUrl');
    if (r?.startsWith('/') && typeof sessionStorage !== 'undefined') sessionStorage.setItem('oauth_redirect', r);
  }, [searchParams]);

  const completeLogin = (userData: Record<string, unknown>, accessToken: string, refreshToken: string) => {
    const user = toUser(userData);
    login(user, accessToken, refreshToken);
    setAuthenticated(user);
    const target = resolvePostLoginRedirect(
      consumeOAuthRedirect(),
      searchParams.get('returnUrl'),
      searchParams.get('redirect'),
    );
    window.location.assign(target);
  };

  return (
    <AuthSplitLayout showMarketingLogo>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tw('loginLead')}</p>
        </div>
        <WalletAuthPanel actionLabel={tw('signIn')} onSuccess={completeLogin} />
        <p className="text-center text-sm text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href="/signup" className="text-primary underline underline-offset-2 font-medium">{t('signUp')}</Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
