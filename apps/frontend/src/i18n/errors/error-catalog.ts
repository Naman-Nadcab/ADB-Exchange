/**
 * Stable API / domain error codes → i18n message keys (presentation layer).
 * Keys are relative to the `errors` next-intl namespace.
 */

export const ERROR_I18N_KEYS = {
  FOREX_ORDER_MARGIN_INSUFFICIENT: 'forex.marginInsufficient',
  CRYPTO_ORDER_INVALID_PRICE: 'crypto.invalidPrice',
  AUTH_OTP_INVALID: 'auth.codes.INVALID_OTP',
  GENERIC_UNKNOWN: 'generic.unknown',
} as const;

export type StableErrorCode = keyof typeof ERROR_I18N_KEYS;

const AUTH_CODE_TO_KEY: Record<string, string> = {
  INVALID_OTP: 'auth.codes.INVALID_OTP',
  INVALID_IDENTIFIER: 'auth.codes.INVALID_IDENTIFIER',
  OTP_CREATE_FAILED: 'auth.codes.OTP_CREATE_FAILED',
  OTP_DELIVERY_FAILED: 'auth.codes.OTP_DELIVERY_FAILED',
  OTP_SEND_FAILED: 'auth.codes.OTP_SEND_FAILED',
  VERIFY_OTP_FAILED: 'auth.codes.VERIFY_OTP_FAILED',
  INVALID_TOKEN: 'auth.codes.INVALID_TOKEN',
  INVALID_JWT_PAYLOAD: 'auth.codes.INVALID_JWT_PAYLOAD',
  UNAUTHORIZED: 'auth.codes.UNAUTHORIZED',
  AUTH_ERROR: 'auth.codes.AUTH_ERROR',
  INVALID_BODY: 'auth.codes.INVALID_BODY',
  INVALID_INPUT: 'auth.codes.INVALID_INPUT',
  VALIDATION_ERROR: 'auth.codes.VALIDATION_ERROR',
};

export function errorCodeToMessageKey(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code in ERROR_I18N_KEYS) {
    return ERROR_I18N_KEYS[code as StableErrorCode];
  }
  if (code in AUTH_CODE_TO_KEY) {
    return AUTH_CODE_TO_KEY[code]!;
  }
  return null;
}

/** Safe user-facing key under the `errors` namespace — never returns raw backend text. */
export function resolveErrorMessageKey(code: string | null | undefined): string {
  return errorCodeToMessageKey(code) ?? ERROR_I18N_KEYS.GENERIC_UNKNOWN;
}
