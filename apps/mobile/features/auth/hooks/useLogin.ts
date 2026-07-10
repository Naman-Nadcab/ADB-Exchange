import { useMutation } from '@tanstack/react-query';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from './useAuthActions';
import type { LoginPasswordRequest } from '@exchange/mobile-types';

export function useLoginPassword() {
  const { completeSession, handleAuthError } = useAuthActions();
  return useMutation({
    mutationFn: (body: LoginPasswordRequest) => getAuthRepository().loginPassword(body),
    onSuccess: (data) => completeSession(data),
    onError: (err) => handleAuthError(err),
  });
}
