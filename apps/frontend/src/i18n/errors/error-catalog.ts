/**
 * Stable API / domain error codes → i18n message keys (presentation layer).
 * Backend codes must remain unchanged; only client-facing copy is localized.
 */

export const ERROR_I18N_KEYS = {
  FOREX_ORDER_MARGIN_INSUFFICIENT: 'errors.forex.marginInsufficient',
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
