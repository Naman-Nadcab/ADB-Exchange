'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { getApiBaseUrl } from '@/lib/getApiUrl';

export default function GoogleLinkCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { accessToken, _hasHydrated } = useAuthStore();
  const [status, setStatus] = useState<'working' | 'success' | 'error'>('working');
  const [message, setMessage] = useState('Linking your Google account…');

  useEffect(() => {
    if (!_hasHydrated) return;
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error || !code || !state) {
      setStatus('error');
      setMessage(error ? 'Google sign-in was cancelled.' : 'Missing authorization details.');
      return;
    }
    if (!accessToken) {
      setStatus('error');
      setMessage('You must be logged in to link an account.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/oauth/google/link/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ code, state }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setStatus('success');
          setMessage('Google account linked successfully.');
          setTimeout(() => router.replace('/dashboard/account'), 1500);
        } else {
          setStatus('error');
          setMessage(json.error?.message || 'Failed to link Google account.');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('Network error while linking your account.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [_hasHydrated, accessToken, params, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
        {status === 'working' && <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />}
        {status === 'success' && <CheckCircle className="w-10 h-10 text-buy mx-auto mb-4" />}
        {status === 'error' && <AlertTriangle className="w-10 h-10 text-sell mx-auto mb-4" />}
        <p className="text-foreground font-medium">{message}</p>
        {status === 'error' && (
          <button
            onClick={() => router.replace('/dashboard/account')}
            className="mt-5 px-5 py-2.5 text-sm font-medium rounded-lg bg-accent hover:bg-accent/70 text-foreground"
          >
            Back to Account
          </button>
        )}
      </div>
    </div>
  );
}
