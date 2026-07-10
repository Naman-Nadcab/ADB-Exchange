export type RequestContext = {
  headers: Record<string, string>;
  skipAuth?: boolean;
  idempotent?: boolean;
};

export type AuthInterceptorDeps = {
  getAccessToken: () => string | null;
};

/** Attach Bearer token when auth is required. */
export function applyAuthInterceptor(
  ctx: RequestContext,
  deps: AuthInterceptorDeps,
): RequestContext {
  if (ctx.skipAuth) return ctx;
  const token = deps.getAccessToken();
  if (!token) return ctx;
  return {
    ...ctx,
    headers: { ...ctx.headers, Authorization: `Bearer ${token}` },
  };
}
