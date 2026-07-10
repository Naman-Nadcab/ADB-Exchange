import { useMutation } from '@tanstack/react-query';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { SendOtpRequest, VerifyOtpRequest, SignupRequest } from '@exchange/mobile-types';
import { useAuthActions } from './useAuthActions';

export function useSendOtp() {
  return useMutation({
    mutationFn: (body: SendOtpRequest) => getAuthRepository().sendOtp(body),
  });
}

export function useVerifyOtp() {
  const { completeSession, handleAuthError } = useAuthActions();
  return useMutation({
    mutationFn: (body: VerifyOtpRequest) => getAuthRepository().verifyOtp(body),
    onSuccess: (data) => {
      if ('accessToken' in data) void completeSession(data);
    },
    onError: (err: unknown) => handleAuthError(err),
  });
}

export function useSignup() {
  const { completeSession, handleAuthError } = useAuthActions();
  return useMutation({
    mutationFn: (body: SignupRequest) => getAuthRepository().signup(body),
    onSuccess: (data) => completeSession(data),
    onError: (err: unknown) => handleAuthError(err),
  });
}
