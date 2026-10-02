import { ApiError } from '@core/api/errors/ApiError';
import type { MobileWalletFailureCode, WalletChangeKind } from './types';

export class WalletConnectorError extends Error {
  constructor(readonly code: MobileWalletFailureCode) {
    super(code);
    this.name = 'WalletConnectorError';
  }
}

export class WalletAccountChangedError extends Error {
  constructor(readonly reason: Exclude<WalletChangeKind, 'disconnect'>) {
    super(reason);
    this.name = 'WalletAccountChangedError';
  }
}

export function mapWalletAuthError(error: unknown): MobileWalletFailureCode {
  if (error instanceof WalletConnectorError) return error.code;
  if (error instanceof ApiError) {
    if (error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED' || error.code === 'RATE_LIMITED' || error.code === 'RATE_LIMIT_UNAVAILABLE') {
      return 'RATE_LIMIT';
    }
    if (error.code === 'CHALLENGE_EXPIRED') return 'CHALLENGE_EXPIRED';
    if (error.status === 0 || error.code === 'NETWORK') return 'NETWORK_ERROR';
    return 'VERIFY_FAILED';
  }
  if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Network request failed')) {
    return 'NETWORK_ERROR';
  }
  return 'NETWORK_ERROR';
}
