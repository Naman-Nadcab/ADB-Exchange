'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { forexApi, unwrap } from '../api/client';
import { hasForexPrivateSession } from '../api/auth-token';

export type ForexLiveKycPolicy = {
  loading: boolean;
  /** Missing flag and load failure keep the gate on so the UI cannot skip a required check. */
  kycRequired: boolean;
  kycVerified: boolean;
};

/**
 * Server Forex KYC policy from live-opening eligibility.
 * Wallet KYC status is not the source of this flag.
 */
export function useForexLiveKycPolicy(): ForexLiveKycPolicy {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authed = isAuthenticated || hasForexPrivateSession();
  const [state, setState] = useState<ForexLiveKycPolicy>({
    loading: true,
    kycRequired: true,
    kycVerified: false,
  });

  useEffect(() => {
    if (!authed) {
      setState({ loading: false, kycRequired: true, kycVerified: false });
      return;
    }
    let cancelled = false;
    (async () => {
      setState((current) => ({ ...current, loading: true }));
      const res = unwrap(await forexApi.getLiveOpeningEligibility());
      if (cancelled) return;
      if (!res.ok) {
        setState({ loading: false, kycRequired: true, kycVerified: false });
        return;
      }
      setState({
        loading: false,
        kycRequired: res.data.kycRequired !== false,
        kycVerified: res.data.kycVerified === true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  return state;
}
