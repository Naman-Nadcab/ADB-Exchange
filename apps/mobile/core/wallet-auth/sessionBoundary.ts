import type { AuthSessionResponse } from '@exchange/mobile-types';

/** Fields that must never be copied into the application auth token store. */
export const FORBIDDEN_APP_SESSION_FIELDS = [
  'caip10',
  'signature',
  'nonce',
  'challenge',
  'challengeId',
  'topic',
  'pairingUri',
  'seed',
  'mnemonic',
  'privateKey',
  'walletPassword',
] as const;

export function toApplicationSession(session: AuthSessionResponse): {
  accessToken: string;
  refreshToken: string;
  userId: string;
} {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    userId: session.user.id,
  };
}

export function applicationSessionHasForbiddenFields(value: Record<string, unknown>): boolean {
  return FORBIDDEN_APP_SESSION_FIELDS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function walletChallengeRequestBody(caip10: string): { caip10: string } {
  return { caip10 };
}

export function walletLoginRequestBody(input: {
  challengeId: string;
  message: string;
  signature: string;
}): { challengeId: string; message: string; signature: string } {
  return {
    challengeId: input.challengeId,
    message: input.message,
    signature: input.signature,
  };
}
