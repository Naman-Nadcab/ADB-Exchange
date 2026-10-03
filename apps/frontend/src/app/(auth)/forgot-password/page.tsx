'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Mail, ArrowLeft } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { ROUTES } from '@/lib/routes';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useTranslations } from 'next-intl';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';

type Step = 'request' | 'reset';

export default function ForgotPasswordPage() {
  const tf = useTranslations('auth.forgot');
  const tw = useTranslations('auth.wallet');
  const { fromApi, networkUnreachable } = useApiErrorMessage();
  const [legacyEntryAvailable, setLegacyEntryAvailable] = useState(true);
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'email' | 'phone'>('email');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const API_URL = getApiBaseUrl();

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/v1/auth/wallet-cutover`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { data?: { legacyEntryAvailable?: boolean } } | null) => {
        if (!cancelled && body?.data?.legacyEntryAvailable === false) setLegacyEntryAvailable(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [API_URL]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/password/reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(fromApi(data, 'generic.unknown'));
        return;
      }
      setStep('reset');
      setCountdown(60);
    } catch (err) {
      setError(err instanceof TypeError ? networkUnreachable() : tf('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      setOtp((prev) => {
        const next = [...prev];
        digits.forEach((d, i) => {
          if (index + i < 6) next[index + i] = d;
        });
        return next;
      });
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
    } else {
      setOtp((prev) => {
        const next = [...prev];
        next[index] = value.replace(/\D/g, '');
        return next;
      });
      if (value && index < 5) otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError(tf('enterOtp'));
      return;
    }
    if (newPassword.length < 8) {
      setError(tf('passwordMin8'));
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError(tf('passwordComplexity'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(tf('passwordsMismatch'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp: otpCode,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || tf('resetFailed'));
        return;
      }
      window.location.href = '/login?reset=success';
    } catch (err) {
      setError(err instanceof TypeError ? networkUnreachable() : tf('networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/password/reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error?.message || tf('resendFailed'));
      else {
        setCountdown(60);
        setOtp(['', '', '', '', '', '']);
      }
    } catch (err) {
      setError(networkUnreachable());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="w-full max-w-md">
        <BrandLogo variant="horizontal-gold" size="header" href={ROUTES.home} className="mb-8" />
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          {tf('backToLogin')}
        </Link>
        <div className="bg-card rounded-xl shadow-xl border border-border p-8">
          {!legacyEntryAvailable ? (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold text-foreground">{tf('requestTitle')}</h1>
              <p className="text-muted-foreground">{tw('forgotClosed')}</p>
              <Link href="/login" className="inline-flex text-primary font-medium hover:underline">{tf('logIn')}</Link>
            </div>
          ) : step === 'request' ? (
            <form onSubmit={handleRequestSubmit} className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">{tf('requestTitle')}</h1>
                <p className="text-muted-foreground">
                  {tf('requestSubtitle')}
                </p>
              </div>
              <div className="flex border-b border-border">
                <button
                  type="button"
                  onClick={() => setIdentifierType('email')}
                  className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    identifierType === 'email'
                      ? 'text-foreground border-foreground'
                      : 'text-muted-foreground border-transparent hover:text-foreground/80'
                  }`}
                >
                  {tf('emailTab')}
                </button>
                <button
                  type="button"
                  onClick={() => setIdentifierType('phone')}
                  className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                    identifierType === 'phone'
                      ? 'text-foreground border-foreground'
                      : 'text-muted-foreground border-transparent hover:text-foreground/80'
                  }`}
                >
                  {tf('mobileTab')}
                </button>
              </div>
              <div>
                <input
                  type={identifierType === 'email' ? 'email' : 'tel'}
                  inputMode={identifierType === 'phone' ? 'numeric' : undefined}
                  value={identifier}
                  onChange={(e) => {
                    if (identifierType === 'phone') {
                      setIdentifier(e.target.value.replace(/\D/g, '').slice(0, 15));
                    } else {
                      setIdentifier(e.target.value);
                    }
                  }}
                  placeholder={identifierType === 'email' ? tf('emailPlaceholder') : tf('mobilePlaceholder')}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground dark:bg-accent"
                  required
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                {loading ? tf('sendingCode') : tf('sendResetCode')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetSubmit} className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">{tf('resetTitle')}</h1>
                <p className="text-muted-foreground">
                  {tf.rich('resetSubtitle', {
                    identifier,
                    highlight: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
                  })}
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground dark:bg-accent"
                  />
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1">{tf('newPassword')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={tf('newPasswordPlaceholder')}
                    className="w-full px-4 py-3 pr-10 border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground dark:bg-accent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1">{tf('confirmPassword')}</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={tf('confirmPlaceholder')}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary text-foreground dark:bg-accent"
                  required
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={countdown > 0 || loading}
                  className={`${countdown > 0 ? 'text-muted-foreground cursor-not-allowed' : 'text-primary hover:underline'}`}
                >
                  {countdown > 0 ? tf('resendCodeCountdown', { time: formatCountdown(countdown) }) : tf('resendCode')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="text-primary hover:underline"
                >
                  {identifierType === 'email' ? tf('changeEmail') : tf('changeNumber')}
                </button>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {submitting ? tf('resetting') : tf('resetPassword')}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">
          {tf('rememberPassword')}{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">{tf('logIn')}</Link>
        </p>
      </div>
    </div>
  );
}
