export type RequestContext = {
  headers: Record<string, string>;
  idempotent?: boolean;
};

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

/** Attach Idempotency-Key for flagged mutations (skip if caller supplied a stable key). */
export function applyIdempotencyInterceptor(ctx: RequestContext): RequestContext {
  if (!ctx.idempotent) return ctx;
  if (ctx.headers['Idempotency-Key']) return ctx;
  return {
    ...ctx,
    headers: { ...ctx.headers, 'Idempotency-Key': randomId() },
  };
}
