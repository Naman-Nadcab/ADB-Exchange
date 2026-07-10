import { Linking } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import { useAuthActions } from './useAuthActions';

const REDIRECT_URI = 'metheorium://oauth/callback';

export function useGoogleOAuth() {
  const { handleAuthError } = useAuthActions();
  return useMutation({
    mutationFn: async () => {
      const { url } = await getAuthRepository().getGoogleOAuthUrl(REDIRECT_URI);
      await Linking.openURL(url);
      return url;
    },
    onError: (err: unknown) => handleAuthError(err),
  });
}

export function useAppleOAuth() {
  const { handleAuthError } = useAuthActions();
  return useMutation({
    mutationFn: async () => {
      const { url } = await getAuthRepository().getAppleOAuthUrl(REDIRECT_URI);
      await Linking.openURL(url);
      return url;
    },
    onError: (err: unknown) => handleAuthError(err),
  });
}

export function useOAuthCallback() {
  const { completeSession, handleAuthError } = useAuthActions();
  return useMutation({
    mutationFn: async (params: {
      provider: 'google' | 'apple';
      code: string;
      state: string;
      id_token?: string;
    }) => {
      if (params.provider === 'google') {
        return getAuthRepository().googleOAuthCallback({
          code: params.code,
          state: params.state,
          redirect_uri: REDIRECT_URI,
        });
      }
      return getAuthRepository().appleOAuthCallback({
        code: params.code,
        state: params.state,
        id_token: params.id_token,
        redirect_uri: REDIRECT_URI,
      });
    },
    onSuccess: (data) => completeSession(data),
    onError: (err: unknown) => handleAuthError(err),
  });
}
