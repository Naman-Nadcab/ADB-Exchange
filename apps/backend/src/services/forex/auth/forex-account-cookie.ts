/**
 * Forex-only active account cookie (isolated from Crypto auth cookies).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../../config/index.js';

export const FOREX_ACTIVE_ACCOUNT_COOKIE = 'mlive_fx_ac';

function cookieSecure(request?: FastifyRequest): boolean {
  const envOverride = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (envOverride === 'false' || envOverride === '0') return false;
  if (envOverride === 'true' || envOverride === '1') return true;
  const raw = request?.headers['x-forwarded-proto'];
  if (typeof raw === 'string') {
    const proto = raw.split(',')[0]?.trim().toLowerCase();
    if (proto === 'https') return true;
    if (proto === 'http') return false;
  }
  return config.env === 'production';
}

export function setForexActiveAccountCookie(reply: FastifyReply, accountId: string): void {
  reply.setCookie(FOREX_ACTIVE_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    secure: cookieSecure(reply.request),
    sameSite: 'lax',
    path: '/',
    maxAge: 90 * 24 * 60 * 60,
  });
}

export function clearForexActiveAccountCookie(reply: FastifyReply): void {
  reply.clearCookie(FOREX_ACTIVE_ACCOUNT_COOKIE, { path: '/' });
}

export function getForexActiveAccountFromRequest(request: FastifyRequest): string | undefined {
  const header = request.headers['x-forex-account-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const fromCookie = request.cookies?.[FOREX_ACTIVE_ACCOUNT_COOKIE];
  return typeof fromCookie === 'string' && fromCookie.trim() ? fromCookie.trim() : undefined;
}
