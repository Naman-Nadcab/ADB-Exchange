'use client';

import { useEffect, useState } from 'react';
import { forexApi, unwrap } from '../api/client';
import { useForexSession } from '../runtime/useForexSession';

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
  const session = useForexSession();
  const authed = session.authed;
  const [state, setState] = useState<ForexLiveKycPolicy>({
    loading: true,
    kycRequired: true,
    kycVerified: false,
  });

  useEffect(() => {
    if (session.resolving) return;
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
  }, [authed, session.resolving]);

  return state;
}
