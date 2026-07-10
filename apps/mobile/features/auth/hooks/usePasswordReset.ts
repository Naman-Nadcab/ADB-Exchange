import { useMutation } from '@tanstack/react-query';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { PasswordResetConfirm, PasswordResetRequest } from '@exchange/mobile-types';
import { useAuthActions } from './useAuthActions';

export function usePasswordResetRequest() {
  const { handleAuthError } = useAuthActions();
  return useMutation({
    mutationFn: (body: PasswordResetRequest) => getAuthRepository().passwordResetRequest(body),
    onError: (err: unknown) => handleAuthError(err),
  });
}

export function usePasswordReset() {
  const { handleAuthError } = useAuthActions();
  return useMutation({
    mutationFn: (body: PasswordResetConfirm) => getAuthRepository().passwordReset(body),
    onError: (err: unknown) => handleAuthError(err),
  });
}
