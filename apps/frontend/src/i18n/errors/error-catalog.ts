/**
 * Stable API / domain error codes → i18n message keys (presentation layer).
 * Keys are relative to the `errors` next-intl namespace.
 */

export const ERROR_I18N_KEYS = {
  FOREX_ORDER_MARGIN_INSUFFICIENT: 'forex.marginInsufficient',
  CRYPTO_ORDER_INVALID_PRICE: 'crypto.invalidPrice',
  AUTH_OTP_INVALID: 'auth.codes.INVALID_OTP',
  GENERIC_UNKNOWN: 'generic.unknown',
  INSUFFICIENT_MARGIN: 'forex.codes.INSUFFICIENT_MARGIN',
  INSUFFICIENT_FOREX_BALANCE: 'forex.codes.INSUFFICIENT_FOREX_BALANCE',
  INVALID_PRICE: 'crypto.codes.INVALID_PRICE',
  INSUFFICIENT_BALANCE: 'crypto.codes.INSUFFICIENT_BALANCE',
  P2P_PAYMENT_EXPIRED: 'p2p.codes.P2P_PAYMENT_EXPIRED',
  P2P_ORDER_CANCELLED: 'p2p.codes.P2P_ORDER_CANCELLED',
  WRONG_NETWORK: 'wallet.codes.WRONG_NETWORK',
  WITHDRAW_BLOCKED: 'wallet.codes.WITHDRAW_BLOCKED',
} as const;

export type StableErrorCode = keyof typeof ERROR_I18N_KEYS;

/** Spot/trading/admin API codes → `errors.trading.codes.*` (parity with legacy errorMessages map). */
const TRADING_API_CODES = new Set([
  'RATE_LIMIT_EXCEEDED',
  'KYC_REQUIRED',
  'WITHDRAWAL_LIMIT_EXCEEDED',
  'COOLDOWN_ACTIVE',
  'INSUFFICIENT_BALANCE',
  'INVALID_2FA',
  'FUND_PASSWORD_REQUIRED',
  'INTERNAL_ERROR',
  'FETCH_FAILED',
  'USER_NOT_FOUND',
  'UPDATE_FAILED',
  'NOT_FOUND',
  'INVALID_ORDER',
  'MARKET_NOT_FOUND',
  'MARKET_DISABLED',
  'MIN_QTY',
  'MIN_NOTIONAL',
  'MARKET_NOT_READY',
  'NO_LIQUIDITY',
  'FOK_NOT_FILLABLE',
  'INSUFFICIENT_QUOTE_BALANCE',
  'INSUFFICIENT_BASE_BALANCE',
  'TRADING_HALTED',
  'MM_EMERGENCY_STOPPED',
  'ORDER_NOT_CANCELLABLE',
  'ORDER_FAILED',
  'CANCEL_FAILED',
  'MARKET_PAUSED',
  'NETWORK_ERROR',
  'UNAUTHORIZED',
  'INVALID_TOKEN',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'ADMIN_IP_NOT_ALLOWED',
  'NO_UPDATES',
  'INVALID_STATUS',
]);

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
  LEGACY_AUTH_DISABLED: 'auth.codes.LEGACY_AUTH_DISABLED',
  LEGACY_SIGNUP_CLOSED: 'auth.codes.LEGACY_SIGNUP_CLOSED',
};

export function errorCodeToMessageKey(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code in ERROR_I18N_KEYS) {
    return ERROR_I18N_KEYS[code as StableErrorCode];
  }
  if (code in AUTH_CODE_TO_KEY) {
    return AUTH_CODE_TO_KEY[code]!;
  }
  if (TRADING_API_CODES.has(code)) {
    return `trading.codes.${code}`;
  }
  return null;
}

/** Safe user-facing key under the `errors` namespace — never returns raw backend text. */
export function resolveErrorMessageKey(code: string | null | undefined): string {
  return errorCodeToMessageKey(code) ?? ERROR_I18N_KEYS.GENERIC_UNKNOWN;
}
