import { ApiError } from '../errors/ApiError';
import { mapErrorCode } from '../errorMapper';

export type ResponseContext = {
  status: number;
  body: unknown;
};

/** Normalize error payloads into ApiError. */
export function applyErrorInterceptor(ctx: ResponseContext): void {
  if (ctx.status >= 200 && ctx.status < 300) return;
  const err = ApiError.fromResponse(ctx.status, ctx.body);
  const mapped = mapErrorCode(err.code);
  throw new ApiError(err.message, err.status, mapped ?? err.code, err.payload);
}
