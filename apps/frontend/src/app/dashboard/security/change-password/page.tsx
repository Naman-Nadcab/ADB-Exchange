'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/auth';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import Link from 'next/link';
import { ChevronRight, AlertCircle, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const tc = useTranslations('security.common');
  const t = useTranslations('security.changePasswordPage');
  const { fromApi } = useApiErrorMessage();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordHistory, setPasswordHistory] = useState<string | null>(null);

  const apiUrl = getApiBaseUrl();

  const validations = {
    minLength: newPassword.length >= 8,
    maxLength: newPassword.length <= 30,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    notSameAsOld: newPassword !== oldPassword || newPassword === '',
    passwordsMatch: newPassword === confirmPassword && newPassword !== '',
  };

  const isValidPassword =
    validations.minLength &&
    validations.maxLength &&
    validations.hasUppercase &&
    validations.hasLowercase &&
    validations.hasNumber &&
    validations.notSameAsOld;

  useEffect(() => {
    const checkPassword = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/v1/auth/check-password`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (data.success) {
          setHasPassword(data.data.hasPassword);
        }
      } catch (err) {
        console.error('Failed to check password status:', err);
      } finally {
        setLoading(false);
      }
    };

    if (accessToken) {
      checkPassword();
    } else {
      setLoading(false);
    }
  }, [accessToken, apiUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setPasswordHistory(null);

    if (!isValidPassword) {
      setError(t('requirementsNotMet'));
      return;
    }

    if (!validations.passwordsMatch) {
      setError(t('passwordsNoMatch'));
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          oldPassword: hasPassword ? oldPassword : undefined,
          newPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(t('success'));
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          router.push('/dashboard/security');
        }, 2000);
      } else {
        if (data.error?.code === 'PASSWORD_REUSED') {
          setPasswordHistory(fromApi(data.error, 'auth.passwordReused'));
        } else {
          setError(fromApi(data.error ?? data, 'auth.changePasswordFailed'));
        }
      }
    } catch {
      setError(t('genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6" aria-label={tc('breadcrumbAria')}>
        <Link href="/dashboard/security" className="hover:text-primary">
          {tc('security')}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground">{t('title')}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="p-6">
          <h1 className="text-xl font-semibold text-foreground mb-4">{t('title')}</h1>

          <div className="flex gap-3 p-4 mb-6 rounded-lg border border-border bg-muted">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-foreground">{t('securityWarning')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {hasPassword && (
              <div>
                <label className="block text-sm text-muted-foreground mb-2">{t('oldPassword')}</label>
                <div className="relative">
                  <input
                    type={showOld ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder={t('oldPasswordPlaceholder')}
                    className="w-full px-4 py-3 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(!showOld)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                    aria-label={showOld ? tc('hidePassword') : tc('showPassword')}
                  >
                    {showOld ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-muted-foreground mb-2">{t('newPassword')}</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('newPasswordPlaceholder')}
                  className="w-full px-4 py-3 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  aria-label={showNew ? tc('hidePassword') : tc('showPassword')}
                >
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {newPassword && (
                <div className="mt-3 space-y-1">
                  <div
                    className={`flex items-center gap-2 text-xs ${validations.minLength ? 'text-buy' : 'text-muted-foreground'}`}
                  >
                    {validations.minLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {t('ruleMin')}
                  </div>
                  <div
                    className={`flex items-center gap-2 text-xs ${validations.maxLength ? 'text-buy' : 'text-sell'}`}
                  >
                    {validations.maxLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {t('ruleMax')}
                  </div>
                  <div
                    className={`flex items-center gap-2 text-xs ${validations.hasUppercase ? 'text-buy' : 'text-muted-foreground'}`}
                  >
                    {validations.hasUppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {t('ruleUpper')}
                  </div>
                  <div
                    className={`flex items-center gap-2 text-xs ${validations.hasLowercase ? 'text-buy' : 'text-muted-foreground'}`}
                  >
                    {validations.hasLowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {t('ruleLower')}
                  </div>
                  <div
                    className={`flex items-center gap-2 text-xs ${validations.hasNumber ? 'text-buy' : 'text-muted-foreground'}`}
                  >
                    {validations.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {t('ruleNumber')}
                  </div>
                  {hasPassword && oldPassword && (
                    <div
                      className={`flex items-center gap-2 text-xs ${validations.notSameAsOld ? 'text-buy' : 'text-sell'}`}
                    >
                      {validations.notSameAsOld ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {t('ruleDifferent')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">{t('confirmPassword')}</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirmPasswordPlaceholder')}
                  className="w-full px-4 py-3 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  aria-label={showConfirm ? tc('hidePassword') : tc('showPassword')}
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && !validations.passwordsMatch && (
                <p className="mt-2 text-xs text-sell">{t('passwordsNoMatch')}</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-border bg-muted p-3">
                <p className="text-sm text-sell">{error}</p>
              </div>
            )}

            {passwordHistory && (
              <div className="rounded-lg border border-border bg-muted p-3">
                <p className="text-sm text-primary">{passwordHistory}</p>
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-border bg-muted p-3">
                <p className="text-sm text-buy">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={Boolean(
                submitting ||
                  !isValidPassword ||
                  !(validations.passwordsMatch ?? false) ||
                  (hasPassword === true && !oldPassword)
              )}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {tc('processing')}
                </>
              ) : (
                tc('confirm')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
