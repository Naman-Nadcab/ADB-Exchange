/**
 * Stable API / domain error codes → i18n message keys (presentation layer).
 * Backend codes must remain unchanged; only client-facing copy is localized.
 */

export const ERROR_I18N_KEYS = {
  FOREX_ORDER_MARGIN_INSUFFICIENT: 'errors.forex.marginInsufficient',
  CRYPTO_ORDER_INVALID_PRICE: 'errors.crypto.invalidPrice',
  AUTH_OTP_INVALID: 'errors.auth.otpInvalid',
  GENERIC_UNKNOWN: 'errors.generic.unknown',
} as const;

export type StableErrorCode = keyof typeof ERROR_I18N_KEYS;

export function errorCodeToMessageKey(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code in ERROR_I18N_KEYS) {
    return ERROR_I18N_KEYS[code as StableErrorCode];
  }
  return null;
}

/** Safe user-facing key — never returns raw backend text or bare codes. */
export function resolveErrorMessageKey(code: string | null | undefined): string {
  return errorCodeToMessageKey(code) ?? ERROR_I18N_KEYS.GENERIC_UNKNOWN;
}
