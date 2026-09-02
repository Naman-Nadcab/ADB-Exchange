'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Eye, EyeOff, Fingerprint, Loader2 } from 'lucide-react';
import { useAuthStore, type User } from '@/store/auth';
import { COOKIE_SESSION_MARKER } from '@/lib/authSession';
import { useAuth } from '@/context/AuthContext';
import { getPasskeyAssertion, isPlatformAuthenticatorAvailable, isWebAuthnSupported } from '@/lib/webauthn';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { consumeOAuthRedirect, getStoredRedirect, resolvePostLoginRedirect } from '@/lib/oauth';
import AuthSplitLayout from '@/components/auth/AuthSplitLayout';

type Step = 'identifier' | 'otp';
type LoginMode = 'password' | 'otp';
const API = getApiBaseUrl();

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const { setAuthenticated } = useAuth();

  const [mode, setMode] = useState<LoginMode>('password');
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [type, setType] = useState<'email' | 'phone'>('email');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const lastSubmitted = useRef('');

  useEffect(() => {
    const r = searchParams.get('redirect') || searchParams.get('returnUrl');
    if (r?.startsWith('/') && typeof sessionStorage !== 'undefined') sessionStorage.setItem('oauth_redirect', r);
  }, [searchParams]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  useEffect(() => {
    if (step === 'otp') router.prefetch(getStoredRedirect() || '/');
  }, [step, router]);

  useEffect(() => {
    if (mode !== 'password' || step !== 'identifier') { setPasskeyAvailable(false); return; }
    const trimmed = identifier.trim();
    if (trimmed.length < 5 || !trimmed.includes('@')) { setPasskeyAvailable(false); return; }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/v1/auth/passkey/available`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled) setPasskeyAvailable(Boolean(data?.data?.available));
      } catch {
        if (!cancelled) setPasskeyAvailable(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [identifier, mode, step]);

  useEffect(() => {
    const code = otp.join('');
    if (step === 'otp' && code.length === 6 && !loading && !sendingOtp && lastSubmitted.current !== code) {
      lastSubmitted.current = code;
      formRef.current?.requestSubmit();
    }
    if (step !== 'otp' || code.length < 6) lastSubmitted.current = '';
  }, [otp, step, loading, sendingOtp]);

  const err = (e: unknown) =>
    e instanceof TypeError && e.message === 'Failed to fetch'
      ? 'Server unreachable. Check backend is running.'
      : String(e instanceof Error ? e.message : e);

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

  const passwordLogin = async () => {
    const email = identifier.trim().toLowerCase();
    if (!email || !password) return setError('Enter email and password');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/v1/auth/login/password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      const errMsg = typeof data?.error === 'string' ? data.error : data?.error?.message;
      if (!res.ok) {
        setError(errMsg ?? `Login failed (${res.status})`);
        return;
      }
      if (data?.success && data?.data?.user) {
        completeLogin(
          data.data.user,
          data.data.accessToken ?? COOKIE_SESSION_MARKER,
          data.data.refreshToken ?? COOKIE_SESSION_MARKER,
        );
      } else {
        setError('Login failed');
      }
    } catch (e) {
      setError(err(e));
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setError('');
    setStep('otp');
    setCountdown(120);
    setSendingOtp(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, type, purpose: 'login' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStep('identifier');
        setError(typeof data?.error === 'object' ? data.error?.message : data?.error ?? `Failed (${res.status})`);
        return;
      }
      if (!data?.success) {
        setStep('identifier');
        setError(data?.error?.message ?? 'Failed to send code');
        return;
      }
    } catch (e) {
      setStep('identifier');
      setError(err(e));
    } finally {
      setSendingOtp(false);
    }
  };

  const passkeyLogin = async () => {
    const email = identifier.trim();
    if (!email) return setError('Enter your email first');
    setPasskeyLoading(true);
    setError('');
    try {
      if (!isWebAuthnSupported()) return setError('Use Chrome or Safari');
      if (!(await isPlatformAuthenticatorAvailable())) return setError('Touch ID / Face ID not available');

      const optRes = await fetch(`${API}/api/v1/auth/passkey/authenticate/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const optData = await optRes.json();
      if (!optRes.ok || !optData?.data?.allowCredentials?.length) {
        setError(optData?.error?.message ?? 'Passkey not available');
        return;
      }

      const result = await getPasskeyAssertion(optData.data);
      if (!result.success) {
        setError(result.error?.message ?? 'Passkey failed');
        return;
      }

      const verifyRes = await fetch(`${API}/api/v1/auth/passkey/authenticate/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: result.credential, challenge: optData.data.challenge }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData?.data?.user) {
        setError(verifyData?.error?.message ?? 'Verification failed');
        return;
      }

      const { user: u, accessToken, refreshToken } = verifyData.data;
      if (u) {
        completeLogin(u, accessToken ?? COOKIE_SESSION_MARKER, refreshToken ?? COOKIE_SESSION_MARKER);
      }
    } catch (e) {
      setError(err(e));
    } finally {
      setPasskeyLoading(false);
    }
  };

  const verifyOtp = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/v1/auth/verify-otp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp: code, type, purpose: 'login' }),
      });
      const data = await res.json().catch(() => ({}));
      const errMsg = typeof data?.error === 'string' ? data.error : data?.error?.message;
      if (!res.ok) {
        setError(errMsg ?? `Verification failed (${res.status})`);
        return;
      }
      if (data?.success && data?.data?.user) {
        completeLogin(
          data.data.user,
          data.data.accessToken ?? COOKIE_SESSION_MARKER,
          data.data.refreshToken ?? COOKIE_SESSION_MARKER,
        );
      } else setError('Verification failed');
    } catch (e) {
      setError(err(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (i: number, v: string) => {
    if (v.length > 1) {
      const digits = v.replace(/\D/g, '').slice(0, 6).split('');
      setOtp((p) => {
        const n = [...p];
        digits.forEach((d, j) => { if (i + j < 6) n[i + j] = d; });
        return n;
      });
      otpRefs.current[Math.min(i + digits.length, 5)]?.focus();
    } else {
      setOtp((p) => { const n = [...p]; n[i] = v.replace(/\D/g, ''); return n; });
      if (v && i < 5) otpRefs.current[i + 1]?.focus();
    }
  };

  const resend = async () => {
    if (countdown > 0) return;
    setSendingOtp(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, type, purpose: 'login' }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setCountdown(120);
        setOtp(['', '', '', '', '', '']);
      } else setError(data?.error?.message ?? 'Resend failed');
    } catch (e) {
      setError(err(e));
    } finally {
      setSendingOtp(false);
    }
  };

  const switchToOtp = () => {
    setMode('otp');
    setError('');
    setType(identifier.includes('@') ? 'email' : 'phone');
  };

  const switchToPassword = () => {
    setMode('password');
    setStep('identifier');
    setError('');
    if (type === 'email' && identifier) return;
    setIdentifier('');
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <AuthSplitLayout showMarketingLogo>
      {searchParams.get('reset') === 'success' && (
        <div className="p-3 mb-5 rounded-xl bg-primary/10 border border-primary/30 text-foreground text-sm">
          Password reset successful. Log in with your new password.
        </div>
      )}

      {step === 'identifier' && mode === 'password' && (
        <form onSubmit={(e) => { e.preventDefault(); passwordLogin(); }} className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in with your email and password.</p>
          </div>

          <div className="space-y-4">
            <input
              type="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email address"
              aria-label="Email address"
              autoComplete="email"
              className="w-full px-4 py-3.5 rounded-xl border border-border bg-card/50 text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
              required
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                autoComplete="current-password"
                className="w-full px-4 py-3.5 pr-12 rounded-xl border border-border bg-card/50 text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline font-medium">
              Forgot password?
            </Link>
          </div>

          {passkeyAvailable && (
            <>
              <div className="rounded-xl p-4 bg-muted/50 border border-border">
                <button type="button" onClick={passkeyLogin} disabled={passkeyLoading || loading} className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all shadow-lg shadow-primary/20">
                  {passkeyLoading ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Authenticating</> : <><Fingerprint className="w-5 h-5" aria-hidden /> Login with Passkey</>}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-accent" />
                <span className="text-xs text-muted-foreground font-medium">or</span>
                <div className="flex-1 h-px bg-accent" />
              </div>
            </>
          )}

          {error && <p className="text-destructive text-sm rounded-lg bg-destructive/10 px-3 py-2" role="alert">{error}</p>}

          <button type="submit" disabled={loading || !identifier.trim() || !password} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 dark:hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Signing in…</span> : 'Sign in'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-accent" />
            <span className="text-xs text-muted-foreground font-medium">or</span>
            <div className="flex-1 h-px bg-accent" />
          </div>

          <button
            type="button"
            onClick={switchToOtp}
            className="w-full py-3 rounded-xl border border-border text-foreground font-medium hover:bg-accent/50 transition-colors"
          >
            Sign in with one-time code
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary underline underline-offset-2 font-medium">Sign up</Link>
          </p>
        </form>
      )}

      {step === 'identifier' && mode === 'otp' && (
        <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }} className="space-y-6">
          <div>
            <button type="button" onClick={switchToPassword} className="text-primary hover:underline text-sm font-medium mb-3">
              ← Back to password
            </button>
            <h1 className="text-2xl font-bold text-foreground">Sign in with code</h1>
            <p className="mt-1 text-sm text-muted-foreground">We&apos;ll send a one-time code to your email or mobile.</p>
          </div>

          <div className="flex p-1 rounded-xl bg-accent/80">
            <button type="button" onClick={() => setType('email')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${type === 'email' ? 'bg-card dark:bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/80'}`}>Email</button>
            <button type="button" onClick={() => setType('phone')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${type === 'phone' ? 'bg-card dark:bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/80'}`}>Mobile</button>
          </div>

          <input
            type={type === 'email' ? 'email' : 'tel'}
            inputMode={type === 'phone' ? 'numeric' : undefined}
            value={identifier}
            onChange={(e) => setIdentifier(type === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 15) : e.target.value)}
            placeholder={type === 'email' ? 'Email address' : 'Phone number'}
            aria-label={type === 'email' ? 'Email address' : 'Phone number'}
            className="w-full px-4 py-3.5 rounded-xl border border-border bg-card/50 text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
            required
          />

          {error && <p className="text-destructive text-sm rounded-lg bg-destructive/10 px-3 py-2" role="alert">{error}</p>}

          <button type="submit" disabled={sendingOtp || !identifier.trim()} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 dark:hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {sendingOtp ? <span className="inline-flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Sending code…</span> : 'Send sign-in code'}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/signup" className="text-primary underline underline-offset-2 font-medium">Sign up</Link>
          </p>
        </form>
      )}

      {step === 'otp' && (
        <form ref={formRef} onSubmit={(e) => { e.preventDefault(); verifyOtp(otp.join('')); }} className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Enter verification code</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a 6-digit code to <strong className="text-foreground/80">{identifier}</strong>
              <button type="button" onClick={() => setStep('identifier')} className="ml-2 text-primary hover:underline inline-flex items-center gap-1 font-medium" aria-label="Change email or phone"><ExternalLink className="w-3.5 h-3.5" /> Change</button>
            </p>
            {process.env.NODE_ENV === 'development' ? (
              <p className="mt-1 text-xs text-muted-foreground/85">
                Local dev hint: OTP is also printed in backend logs for test flows.
              </p>
            ) : null}
          </div>

          <div className="flex gap-1.5 justify-center">
            {otp.map((d, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={d}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Backspace' && !otp[i] && i > 0 && otpRefs.current[i - 1]?.focus()}
                aria-label={`Digit ${i + 1} of 6`}
                className="w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-lg border-2 border-border bg-card/50 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            ))}
          </div>

          {error && <p className="text-destructive text-sm text-center rounded-lg bg-destructive/10 px-3 py-2" role="alert">{error}</p>}

          <div className="flex justify-between items-center text-sm">
            <button type="button" onClick={resend} disabled={countdown > 0} className={countdown > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:underline font-medium'}>
              Resend code
            </button>
            {countdown > 0 && <span className="text-muted-foreground tabular-nums">{fmt(countdown)}</span>}
          </div>

          <button type="submit" disabled={loading || otp.join('').length !== 6} className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/85 text-primary-foreground font-semibold disabled:opacity-50 transition-colors">
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Verifying…</span> : 'Verify & continue'}
          </button>
        </form>
      )}
    </AuthSplitLayout>
  );
}
