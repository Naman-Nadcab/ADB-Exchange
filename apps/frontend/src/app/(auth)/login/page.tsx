'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuthStore, type User } from '@/store/auth';
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
  const ts = useTranslations('auth.signup');
  const tw = useTranslations('auth.wallet');
  const [terms, setTerms] = useState(false);

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
        <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-border bg-muted/50 dark:bg-accent/30 hover:bg-accent/50 transition-colors">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-primary rounded border-border"
            aria-label={ts('acceptTermsAria')}
          />
          <span className="text-sm text-muted-foreground">
            {ts.rich('termsAgreement', {
              terms: (chunks) => <Link href="/terms" className="text-primary hover:underline">{chunks}</Link>,
              privacy: (chunks) => <Link href="/privacy" className="text-primary hover:underline">{chunks}</Link>,
            })}
          </span>
        </label>
        <WalletAuthPanel actionLabel={tw('signIn')} disabled={!terms} onSuccess={completeLogin} />
      </div>
    </AuthSplitLayout>
  );
}
