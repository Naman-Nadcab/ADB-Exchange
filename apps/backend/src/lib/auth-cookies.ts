import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';

export const ACCESS_COOKIE = 'mlive_at';
export const REFRESH_COOKIE = 'mlive_rt';

const isProd = config.env === 'production';

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
  };
}

/** Access token cookie lifetime — aligned with JWT expiry (dev uses longer window). */
function accessCookieMaxAgeSec(): number {
  return config.env === 'development' ? 12 * 60 * 60 : 15 * 60;
}

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  reply.setCookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    maxAge: accessCookieMaxAgeSec(),
  });
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearAuthCookies(reply: FastifyReply): void {
  const opts = { path: '/' as const };
  reply.clearCookie(ACCESS_COOKIE, opts);
  reply.clearCookie(REFRESH_COOKIE, opts);
}

export function getRefreshTokenFromRequest(request: FastifyRequest): string | undefined {
  const body = request.body as { refreshToken?: string } | undefined;
  const fromBody = body?.refreshToken?.trim();
  if (fromBody) return fromBody;
  const fromCookie = request.cookies?.[REFRESH_COOKIE];
  return typeof fromCookie === 'string' && fromCookie.length > 0 ? fromCookie : undefined;
}

export function getAccessTokenFromRequest(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const fromCookie = request.cookies?.[ACCESS_COOKIE];
  return typeof fromCookie === 'string' && fromCookie.length > 0 ? fromCookie : undefined;
}
