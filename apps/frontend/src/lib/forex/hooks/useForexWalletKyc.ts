'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { hasForexPrivateSession } from '../api/auth-token';
import { useAuthStore } from '@/store/auth';

/**
 * Crypto wallet KYC status (`/api/v1/wallet/kyc-status`).
 * Forex live-account gating uses `useForexLiveKycPolicy`, not this hook.
 */
export type ForexWalletKyc = { verified: boolean; status: string; loading: boolean };

export function useForexWalletKyc(): ForexWalletKyc {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authed = isAuthenticated || hasForexPrivateSession();
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authed) {
      setVerified(false);
      setStatus('unknown');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/wallet/kyc-status`, {
          credentials: 'include',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.success && data.data) {
          setVerified(Boolean(data.data.verified));
          setStatus(String(data.data.status ?? 'unknown'));
        }
      } catch {
        if (!cancelled) {
          setVerified(false);
          setStatus('unknown');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, accessToken]);

  return { verified, status, loading };
}
