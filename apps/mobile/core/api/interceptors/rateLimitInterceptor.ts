import { ApiError } from '../errors/ApiError';

export type ResponseContext = {
  status: number;
  headers: Headers;
  body: unknown;
};

/** Map 429 responses — no UX wiring in Sprint 0. */
export function applyRateLimitInterceptor(ctx: ResponseContext): ResponseContext {
  if (ctx.status !== 429) return ctx;
  const retryAfter = ctx.headers.get('Retry-After');
  throw new ApiError(
    retryAfter ? `Rate limited. Retry after ${retryAfter}s` : 'Rate limited',
    429,
    'RATE_LIMITED',
    { retryAfter },
  );
}
