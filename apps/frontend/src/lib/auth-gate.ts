/**
 * Edge auth gate.
 *
 * A cookie that only looks like a JWT is not proof of a session. Sending
 * /login and /signup to /dashboard from that cookie loops: the dashboard
 * learns the session is dead, sends the browser back to /login, and the gate
 * sends it to the dashboard again. Auth pages always render. GuestOnly moves
 * a confirmed session into the app.
 */

const PROTECTED_PREFIXES = ['/dashboard', '/wallet', '/orders', '/p2p'];

export function authGateRedirect(pathname: string, sessionValid: boolean): 'login' | null {
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isProtected && !sessionValid) return 'login';
  return null;
}
