/**
 * POST /api/v1/auth/wallet/login
 * Unauthenticated. Verifies a server-issued challenge, resolves users.id,
 * then opens the existing application session (user_sessions, Redis, JWT, cookies).
 * Does not create a second session system.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { config } from '../config/index.js';
import { setAuthCookies } from '../lib/auth-cookies.js';
import { getClientIp } from '../lib/client-ip.js';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { rateLimitByIdentifier, rateLimitByIp, replyToRateLimit, takeRateLimitSlot } from '../lib/rate-limit-fastify.js';
import { getDeviceIdFromRequest, logUserActivity } from '../services/activity-monitor.service.js';
import { clearFailedLoginAttempts, createSession, type CreateSessionParams } from '../services/session.service.js';
import {
  resolveWalletLogin,
  WalletLoginRetry,
  type WalletLoginIdentity,
} from '../services/wallet-auth-login.service.js';
import {
  messageSha256,
  WalletAuthDenied,
  WalletVerifyError,
  WalletVerifyRateLimited,
} from '../services/wallet-auth-verify.service.js';

export const WALLET_LOGIN_IP_LIMIT = 10;
export const WALLET_LOGIN_IP_WINDOW_SEC = 60;
export const WALLET_LOGIN_CHALLENGE_LIMIT = 10;
export const WALLET_LOGIN_CHALLENGE_WINDOW_SEC = 10 * 60;
export const WALLET_LOGIN_ADDRESS_LIMIT = 10;
export const WALLET_LOGIN_ADDRESS_WINDOW_SEC = 10 * 60;

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const ALLOWED_FIELDS = new Set(['challengeId', 'message', 'signature']);

type SessionOpener = (params: CreateSessionParams) => ReturnType<typeof createSession>;

let sessionOpener: SessionOpener = createSession;

/** Test-only. Production always uses createSession. */
export function setWalletLoginSessionOpenerForTests(opener: SessionOpener | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Wallet login session opener override is test-only');
  }
  sessionOpener = opener ?? createSession;
}

function clientVerifyError(code: WalletVerifyError['code']): { status: number; message: string } {
  if (code === 'CHALLENGE_EXPIRED') return { status: 400, message: 'Expired challenge' };
  if (code === 'CHALLENGE_UNAVAILABLE') return { status: 400, message: 'Challenge unavailable' };
  if (code === 'INVALID_SIGNATURE') return { status: 400, message: 'Invalid signature' };
  return { status: 400, message: 'Invalid challenge' };
}

async function enforceAddressLimit(normalizedAddress: string): Promise<void> {
  const slot = await takeRateLimitSlot(
    'auth:wallet-login',
    `id:${normalizedAddress}`,
    WALLET_LOGIN_ADDRESS_LIMIT,
    WALLET_LOGIN_ADDRESS_WINDOW_SEC,
    config.rateLimit.failClosed
  );
  if (!slot.allowed) throw new WalletVerifyRateLimited(slot.unavailable, `id:${normalizedAddress}`);
}

function signTokens(app: FastifyInstance, identity: WalletLoginIdentity, sessionId: string) {
  const accessToken = app.jwt.sign(
    {
      userId: identity.userId,
      email: identity.user.email || undefined,
      phone: identity.user.phone || undefined,
      role: 'user',
      sessionId,
    },
    { expiresIn: config.jwt.expiresIn }
  );
  const refreshToken = app.jwt.sign(
    { userId: identity.userId, sessionId, type: 'refresh' },
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

function sendLogin(reply: FastifyReply, identity: WalletLoginIdentity, accessToken: string, refreshToken: string) {
  setAuthCookies(reply, accessToken, refreshToken);
  return reply.send({
    success: true,
    data: {
      user: {
        id: identity.user.id,
        email: identity.user.email,
        phone: identity.user.phone,
        username: identity.user.username,
        status: identity.user.status,
        emailVerified: identity.user.emailVerified,
        phoneVerified: identity.user.phoneVerified,
        tierLevel: identity.user.tierLevel,
      },
      accessToken,
      refreshToken,
    },
  });
}

export default async function walletLoginRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', async (request, reply) => {
    const body = request.body;
    if (body == null || typeof body !== 'object' || Array.isArray(body)) return;
    const extra = Object.keys(body as Record<string, unknown>).filter((key) => !ALLOWED_FIELDS.has(key));
    if (extra.length === 0) return;
    logger.info('Wallet auth login rejected', {
      code: 'INVALID_CHALLENGE',
      ip: getClientIp(request),
      outcome: 'rejected',
    });
    return reply.status(400).send({
      success: false,
      error: { code: 'INVALID_CHALLENGE', message: 'Invalid challenge' },
    });
  });

  app.post<{
    Body: { challengeId: string; message: string; signature: string };
  }>('/wallet/login', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['challengeId', 'message', 'signature'],
        properties: {
          challengeId: { type: 'string', minLength: 36, maxLength: 36 },
          message: { type: 'string', minLength: 1, maxLength: 4096 },
          signature: { type: 'string', minLength: 1, maxLength: 256 },
        },
      },
    },
    preHandler: [
      rateLimitByIp('auth:wallet-login', WALLET_LOGIN_IP_LIMIT, WALLET_LOGIN_IP_WINDOW_SEC, {
        failClosed: config.rateLimit.failClosed,
      }),
      rateLimitByIdentifier(
        'auth:wallet-login',
        WALLET_LOGIN_CHALLENGE_LIMIT,
        WALLET_LOGIN_CHALLENGE_WINDOW_SEC,
        (req) => {
          const body = req.body as { challengeId?: string } | undefined;
          return typeof body?.challengeId === 'string' ? body.challengeId : null;
        },
        { failClosed: config.rateLimit.failClosed, preserveCase: true }
      ),
    ],
  }, async (request, reply) => {
    const { challengeId, message, signature } = request.body;
    const ip = getClientIp(request);
    const messageHash = messageSha256(message);
    try {
      const identity = await resolveWalletLogin({
        challengeId,
        message,
        signature,
        frontendUrl: config.frontendUrl,
        transaction: (fn) => db.transaction((client) => fn((sql, params) => client.query(sql, params))),
        beforeSignature: (row) => enforceAddressLimit(row.normalizedAddress),
      });

      let sessionId: string;
      try {
        const opened = await sessionOpener({
          userId: identity.userId,
          deviceId: getDeviceIdFromRequest(request.headers as Record<string, string | undefined>),
          deviceType: 'web',
          ipAddress: ip,
          userAgent: request.headers['user-agent'],
          ttlSeconds: SESSION_TTL_SECONDS,
          authMethod: 'wallet',
        });
        sessionId = opened.sessionId;
      } catch (sessionError) {
        logger.error('Wallet auth login session creation failed', {
          userId: identity.userId,
          walletId: identity.walletId,
          challengeId: identity.challengeId,
          namespace: identity.namespace,
          chainReference: identity.chainReference,
          normalizedAddress: identity.normalizedAddress,
          messageSha256: messageHash,
          ip,
          outcome: 'session_failed',
          pgCode: typeof sessionError === 'object' && sessionError !== null && 'code' in sessionError
            ? String((sessionError as { code?: unknown }).code)
            : undefined,
        });
        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Login failed. Please try again.' },
        });
      }

      const tokens = signTokens(app, identity, sessionId);
      if (!tokens.accessToken.trim() || !tokens.refreshToken.trim()) {
        logger.error('Wallet auth login token generation failed', { userId: identity.userId });
        return reply.status(500).send({
          success: false,
          error: { code: 'TOKEN_GENERATION_FAILED', message: 'Login failed. Please try again.' },
        });
      }

      await clearFailedLoginAttempts(identity.userId);
      logUserActivity({
        userId: identity.userId,
        action: 'login_success',
        sessionId,
        ipAddress: ip,
        userAgent: request.headers['user-agent'],
        deviceId: getDeviceIdFromRequest(request.headers as Record<string, string | undefined>),
        metadata: {
          method: 'wallet',
          auth_method: 'wallet',
          namespace: identity.namespace,
          chainReference: identity.chainReference,
          walletId: identity.walletId,
          challengeId: identity.challengeId,
          messageSha256: messageHash,
          normalizedAddress: identity.normalizedAddress,
        },
      }).catch(() => {});

      logger.info('Wallet auth login succeeded', {
        userId: identity.userId,
        walletId: identity.walletId,
        challengeId: identity.challengeId,
        namespace: identity.namespace,
        chainReference: identity.chainReference,
        normalizedAddress: identity.normalizedAddress,
        messageSha256: messageHash,
        createdUser: identity.createdUser,
        ip,
        outcome: 'success',
      });

      return sendLogin(reply, identity, tokens.accessToken, tokens.refreshToken);
    } catch (err) {
      if (reply.sent) return;
      if (err instanceof WalletVerifyRateLimited) {
        replyToRateLimit(reply, 'auth:wallet-login', err.identifier, err.unavailable);
        return;
      }
      if (err instanceof WalletVerifyError) {
        const error = clientVerifyError(err.code);
        logger.info('Wallet auth login rejected', {
          challengeId: err.challengeId,
          namespace: err.namespace,
          chainReference: err.chainReference,
          normalizedAddress: err.normalizedAddress,
          messageSha256: messageHash,
          code: err.code,
          ip,
          outcome: 'rejected',
        });
        return reply.status(error.status).send({
          success: false,
          error: { code: err.code, message: error.message },
        });
      }
      if (err instanceof WalletAuthDenied) {
        logger.info('Wallet auth login rejected', {
          challengeId,
          userId: err.userId,
          messageSha256: messageHash,
          code: err.code,
          ip,
          outcome: 'rejected',
        });
        if (err.userId) {
          logUserActivity({
            userId: err.userId,
            action: 'login_failed',
            ipAddress: ip,
            userAgent: request.headers['user-agent'],
            metadata: { method: 'wallet', reason: err.code },
          }).catch(() => {});
        }
        if (err.code === 'ACCOUNT_LOCKED') {
          const until = err.lockedUntil ? err.lockedUntil.toISOString() : '';
          return reply.status(401).send({
            success: false,
            error: {
              code: 'ACCOUNT_LOCKED',
              message: until
                ? `Account temporarily locked. Try again after ${until}`
                : 'Account temporarily locked',
            },
          });
        }
        if (err.code === 'ACCOUNT_INACTIVE') {
          return reply.status(403).send({
            success: false,
            error: { code: 'ACCOUNT_INACTIVE', message: 'Account inactive' },
          });
        }
        return reply.status(403).send({
          success: false,
          error: { code: 'WALLET_UNAVAILABLE', message: 'Wallet unavailable' },
        });
      }
      if (err instanceof WalletLoginRetry) {
        logger.error('Wallet auth login conflict unresolved', {
          challengeId,
          messageSha256: messageHash,
          ip,
          outcome: 'error',
        });
        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Login failed. Please try again.' },
        });
      }
      logger.error('Wallet auth login failed', {
        challengeId,
        messageSha256: messageHash,
        ip,
        outcome: 'error',
        pgCode: typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : undefined,
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Login failed. Please try again.' },
      });
    }
  });
}
