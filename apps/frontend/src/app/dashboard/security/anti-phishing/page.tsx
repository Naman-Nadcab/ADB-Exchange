'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/toaster';

export default function AntiPhishingPage() {
  const tp = useTranslations('account.antiPhishingPage');
  const tc = useTranslations('account.common');
  const tn = useTranslations('common.notifications');
  const tt = useTranslations('account.toasts');
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [existingCode, setExistingCode] = useState('');
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await api.get<{ code: string }>('/api/v1/auth/anti-phishing/status', { notifyOnError: false });
    if (res.success && res.data) {
      setExistingCode(res.data.code || '');
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const hasCode = Boolean(existingCode);
  const canSubmit =
    newCode.length >= 4 &&
    newCode.length <= 20 &&
    /^[a-zA-Z0-9_]+$/.test(newCode) &&
    (!hasCode || oldCode === existingCode);

  const handleSubmit = async () => {
    if (newCode.length < 4 || newCode.length > 20) {
      toast({
        title: tn('invalidCodeTitle'),
        description: tt('antiPhishingInvalidDesc'),
        variant: 'destructive',
      });
      return;
    }
    if (hasCode && oldCode !== existingCode) {
      toast({ title: tn('verificationTitle'), description: tt('antiPhishingMismatch'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const body = hasCode ? { code: newCode, oldCode } : { code: newCode };
    const res = await api.post('/api/v1/auth/anti-phishing/set', body);
    setSubmitting(false);
    if (res.success) {
      toast({ title: tn('savedTitle'), description: tt('antiPhishingSavedDesc'), variant: 'success' });
      setExistingCode(newCode);
      setOldCode('');
      setNewCode('');
      router.push('/dashboard/security');
    }
  };

  if (!accessToken) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">{tp('signInPrompt')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-4 lg:p-6">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/security" className="hover:text-primary">
          {tp('breadcrumbSecurity')}
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" />
        <span className="text-foreground">{tp('breadcrumbCurrent')}</span>
      </div>

      <div className="mb-8 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
          <BadgeCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{tp('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tp('subtitle')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          {hasCode && (
            <div>
              <label htmlFor="anti-old" className="mb-2 block text-sm font-medium text-foreground">
                {tp('currentCodeLabel')}
              </label>
              <input
                id="anti-old"
                type="text"
                value={oldCode}
                onChange={(e) => setOldCode(e.target.value)}
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                placeholder={tp('currentCodePlaceholder')}
              />
            </div>
          )}
          <div>
            <label htmlFor="anti-new" className="mb-2 block text-sm font-medium text-foreground">
              {hasCode ? tp('newCodeLabel') : tp('newCodeInitialLabel')}
            </label>
            <input
              id="anti-new"
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
              autoComplete="off"
              className="w-full rounded-xl border border-border bg-muted px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              placeholder={tp('newCodePlaceholder')}
            />
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard/security')}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {tc('cancel')}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {tc('save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
