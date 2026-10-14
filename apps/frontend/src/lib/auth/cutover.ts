/**
 * Public cutover view. A failed or slow read stays open: email and phone
 * sign-in remain available. The server still refuses legacy session issuance
 * when the mode is wallet-only.
 */

export type AuthCutoverView = {
  walletPrimary: boolean;
  legacyEntryAvailable: boolean;
};

const OPEN: AuthCutoverView = { walletPrimary: false, legacyEntryAvailable: true };

export const AUTH_CUTOVER_TIMEOUT_MS = 4000;
export const AUTH_REQUEST_TIMEOUT_MS = 20000;

export function interpretCutoverBody(body: unknown): AuthCutoverView {
  if (!body || typeof body !== 'object') return OPEN;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return OPEN;
  const view = data as { walletPrimary?: unknown; legacyEntryAvailable?: unknown };
  return {
    walletPrimary: view.walletPrimary === true,
    legacyEntryAvailable: view.legacyEntryAvailable !== false,
  };
}

export async function loadAuthCutover(apiBase: string, parent?: AbortSignal): Promise<AuthCutoverView> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_CUTOVER_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  parent?.addEventListener('abort', onAbort);
  try {
    const response = await fetch(`${apiBase}/api/v1/auth/wallet-cutover`, { signal: controller.signal });
    if (!response.ok) return OPEN;
    return interpretCutoverBody(await response.json().catch(() => null));
  } catch {
    return OPEN;
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', onAbort);
  }
}

/** Bound a login or signup request so the button cannot spin forever. */
export function authFetch(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = AUTH_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const parent = init.signal;
  const onAbort = () => controller.abort();
  parent?.addEventListener('abort', onAbort);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    parent?.removeEventListener('abort', onAbort);
  });
}
