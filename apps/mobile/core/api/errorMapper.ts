import { ERROR_CODE_MAP } from './errors/errorCodes';

/** Map backend error codes to mobile taxonomy — no UX routing in Sprint 0. */
export function mapErrorCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return ERROR_CODE_MAP[code] ?? code;
}
