import { resolveErrorMessageKey } from '@/i18n/errors/error-catalog';

type ApiErrorShape = {
  error?: { code?: string; message?: string } | string;
  message?: string;
};

const INTERNAL_PATTERNS = [
  /jwt/i,
  /middleware/i,
  /stack/i,
  /sql/i,
  /ECONNREFUSED/i,
  /Unexpected token/i,
];

export function extractApiErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as ApiErrorShape;
  if (p.error && typeof p.error === 'object' && typeof p.error.code === 'string') {
    return p.error.code;
  }
  return null;
}

export function extractApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as ApiErrorShape;
  if (typeof p.error === 'string') return p.error;
  if (p.error && typeof p.error === 'object' && typeof p.error.message === 'string') {
    return p.error.message;
  }
  if (typeof p.message === 'string') return p.message;
  return null;
}

export function looksLikeInternalErrorMessage(message: string): boolean {
  return INTERNAL_PATTERNS.some((re) => re.test(message));
}

/** Resolve a next-intl `errors` namespace relative key (e.g. `auth.codes.INVALID_OTP`). */
export function errorCodeToRelativeKey(code: string | null | undefined): string {
  return resolveErrorMessageKey(code);
}

export function localizeApiError(
  payload: unknown,
  translateErrors: (relativeKey: string) => string,
  fallbackRelativeKey: string
): string {
  const code = extractApiErrorCode(payload);
  if (code) {
    const rel = errorCodeToRelativeKey(code);
    try {
      const msg = translateErrors(rel);
      if (msg && msg !== rel) return msg;
    } catch {
      /* fall through */
    }
  }

  const raw = extractApiErrorMessage(payload);
  if (raw && !looksLikeInternalErrorMessage(raw)) {
    return raw;
  }

  return translateErrors(fallbackRelativeKey);
}
