/** Edge-safe JWT exp check for middleware (no signature verify — gate only). */
export function isAccessCookieLikelyValid(token: string | undefined | null): boolean {
  if (!token || token.length < 20) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp > Math.floor(Date.now() / 1000) + 15;
  } catch {
    return false;
  }
}
