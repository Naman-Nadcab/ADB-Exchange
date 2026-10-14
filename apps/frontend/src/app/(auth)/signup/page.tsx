'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore, type User } from '@/store/auth';
import { COOKIE_SESSION_MARKER } from '@/lib/authSession';
import { useAuth } from '@/context/AuthContext';
import { resolvePostLoginRedirect } from '@/lib/oauth';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';
import { WalletAuthPanel } from '@/components/auth/WalletAuthPanel';
import { useTranslations } from 'next-intl';

function sessionUser(d: Record<string, unknown>): User {
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

export default function SignupPage() {
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const { setAuthenticated } = useAuth();
  const ts = useTranslations('auth.signup');
  const tw = useTranslations('auth.wallet');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');

  return (
    <AuthSplitLayout showMarketingLogo>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{ts('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ts('subtitle')}</p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-border bg-muted/50 dark:bg-accent/30 hover:bg-accent/50 transition-colors">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => {
              setTerms(e.target.checked);
              if (e.target.checked) setError('');
            }}
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

        {error && <p className="text-destructive text-sm rounded-lg bg-destructive/10 px-3 py-2" role="alert">{error}</p>}

        <WalletAuthPanel
          actionLabel={tw('signUp')}
          disabled={!terms}
          onSuccess={(user, accessToken, refreshToken) => {
            if (!terms) {
              setError(ts('acceptTerms'));
              return;
            }
            const session = sessionUser(user);
            login(session, accessToken || COOKIE_SESSION_MARKER, refreshToken || COOKIE_SESSION_MARKER);
            setAuthenticated(session);
            const target = resolvePostLoginRedirect(
              searchParams.get('returnUrl'),
              searchParams.get('redirect'),
            );
            window.location.assign(target);
          }}
        />

        <p className="text-center text-sm text-muted-foreground">
          {ts('haveAccount')}{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">{ts('logIn')}</Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
