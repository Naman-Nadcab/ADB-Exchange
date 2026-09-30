/**
 * Forex-only session gate. Accepts Bearer or the existing httpOnly access cookie.
 * Same JWT + session checks as app.authenticate. Does not change Crypto auth.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAccessTokenFromRequest } from '../../../lib/auth-cookies.js';
import { isSessionValid } from '../../session.service.js';

/** WebSocket upgrade: Bearer or httpOnly access cookie (same contract as forexAuthenticate). */
export async function resolveForexWsUserId(app: FastifyInstance, request: FastifyRequest): Promise<string | undefined> {
  const token = getAccessTokenFromRequest(request);
  if (!token || !app.hasDecorator('jwt')) return undefined;
  try {
    const decoded = app.jwt.verify<{
      userId: string;
      type?: string;
      sessionId?: string;
    }>(token);
    if (decoded.type === 'admin') return undefined;
    const sessionId = decoded.sessionId ?? '';
    if (!(await isSessionValid(sessionId))) return undefined;
    return decoded.userId;
  } catch {
    return undefined;
  }
}

export function forexAuthenticate(app: FastifyInstance) {
  return async function forexAuthenticateHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const token = getAccessTokenFromRequest(request);
      // Isolated route tests decorate `authenticate` and never register @fastify/jwt.
      // Production always has the jwt decorator — this branch never runs there.
      if (!token && !app.hasDecorator('jwt') && typeof app.authenticate === 'function') {
        await app.authenticate(request, reply);
        return;
      }
      if (!token) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const decoded = app.jwt.verify<{
        userId: string;
        email?: string;
        phone?: string;
        role?: string;
        sessionId?: string;
        type?: string;
        impersonatedBy?: string;
      }>(token);

      if (decoded.type === 'admin') {
        return reply.status(401).send({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Use user token for this route' },
        });
      }

      if (decoded.type === 'impersonation' && decoded.impersonatedBy) {
        request.user = {
          id: decoded.userId,
          email: decoded.email,
          phone: decoded.phone,
          role: decoded.role ?? 'user',
          sessionId: decoded.sessionId ?? '',
        };
        return;
      }

      const sessionId = decoded.sessionId ?? '';
      const valid = await isSessionValid(sessionId);
      if (!valid) {
        return reply.status(401).send({
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'Session expired' },
        });
      }

      request.user = {
        id: decoded.userId,
        email: decoded.email ?? '',
        phone: decoded.phone,
        role: decoded.role ?? 'user',
        sessionId,
      };
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid token' },
      });
    }
  };
}
