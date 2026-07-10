import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { getUserRepository, getKycRepository, getSupportRepository, getPushRepository } from '@core/repositories/UserRepository';

export const PROFILE_KEY = ['account', 'profile'] as const;
export const AUTH_PROFILE_KEY = ['account', 'auth-profile'] as const;
export const SECURITY_SETTINGS_KEY = ['account', 'security-settings'] as const;
export const SESSIONS_KEY = ['account', 'sessions'] as const;
export const ACTIVITY_KEY = ['account', 'activity'] as const;
export const NOTIFICATIONS_KEY = ['user', 'notifications'] as const;
export const PREFERENCES_KEY = ['account', 'preferences'] as const;
export const API_KEYS_KEY = ['account', 'api-keys'] as const;
export const REFERRAL_KEY = ['account', 'referral'] as const;
export const KYC_KEY = ['account', 'kyc'] as const;
export const TICKETS_KEY = ['account', 'tickets'] as const;
export const FEE_TIER_KEY = ['account', 'fee-tier'] as const;

export function useAuthProfile() {
  return useQuery({ queryKey: AUTH_PROFILE_KEY, queryFn: () => getAuthRepository().getProfile(), staleTime: 60_000 });
}

export function useUserProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => getUserRepository().getProfile(), staleTime: 60_000 });
}

export function useSecuritySettings() {
  return useQuery({
    queryKey: SECURITY_SETTINGS_KEY,
    queryFn: () => getAuthRepository().getSecuritySettings(),
    staleTime: 30_000,
  });
}

export function useSessions() {
  return useQuery({ queryKey: SESSIONS_KEY, queryFn: () => getUserRepository().getSessions(), staleTime: 30_000 });
}

export function useLoginActivity() {
  return useQuery({ queryKey: ACTIVITY_KEY, queryFn: () => getUserRepository().getActivity(), staleTime: 60_000 });
}

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => getUserRepository().getNotifications(),
    staleTime: 30_000,
  });
}

export function useNotificationMutations() {
  const qc = useQueryClient();
  return {
    markRead: useMutation({
      mutationFn: (id: string) => getUserRepository().markNotificationRead(id),
      onSuccess: () => void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
    }),
    markAllRead: useMutation({
      mutationFn: () => getUserRepository().markAllNotificationsRead(),
      onSuccess: () => void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
    }),
  };
}

export function usePreferences() {
  return useQuery({ queryKey: PREFERENCES_KEY, queryFn: () => getAuthRepository().getPreferences(), staleTime: 120_000 });
}

export function useSavePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: getAuthRepository().savePreferences.bind(getAuthRepository()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: PREFERENCES_KEY }),
  });
}

export function useKycStatus() {
  return useQuery({ queryKey: KYC_KEY, queryFn: () => getKycRepository().getStatus(), staleTime: 30_000 });
}

export function useApiKeys() {
  return useQuery({ queryKey: API_KEYS_KEY, queryFn: () => getAuthRepository().getApiKeys(), staleTime: 30_000 });
}

export function useReferralAnalytics() {
  return useQuery({ queryKey: REFERRAL_KEY, queryFn: () => getUserRepository().getReferralAnalytics(), staleTime: 60_000 });
}

export function useReferrals() {
  return useQuery({ queryKey: [...REFERRAL_KEY, 'list'], queryFn: () => getUserRepository().getReferrals(), staleTime: 60_000 });
}

export function useSupportTickets() {
  return useQuery({ queryKey: TICKETS_KEY, queryFn: () => getSupportRepository().getTickets(), staleTime: 30_000 });
}

export function useFeeTier() {
  return useQuery({ queryKey: FEE_TIER_KEY, queryFn: () => getUserRepository().getFeeTier(), staleTime: 120_000 });
}

export function usePushRegistration() {
  return useMutation({
    mutationFn: (body: { endpoint: string; platform?: string; token?: string }) =>
      getPushRepository().subscribe(body),
  });
}
