/**
 * Lost-wallet recovery for the signed-in users.id.
 * Email OTP cannot attach a wallet. The client cannot set approval or wallet status.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';
import { getClientIp } from '../lib/client-ip.js';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import {
  AUTHORIZE_RECOVERY_ACTION,
  MARK_COMPROMISED_ACTION,
  REPLACE_WALLET_ACTION,
} from '../lib/wallet-action-message.js';
import { rateLimitByIp, rateLimitByUser } from '../lib/rate-limit-fastify.js';
import { getDeviceIdFromRequest, logUserActivity } from '../services/activity-monitor.service.js';
import { messageSha256 } from '../services/wallet-auth-verify.service.js';
import {
  assertEmailCannotLinkWallet,
  cancelRecovery,
  completeRecoveryCooldown,
  createRecoveryChallenge,
  getRecoveryView,
  markWalletCompromised,
  requestRecovery,
  submitTotpForReview,
  verifyRecoveryFactor,
  verifyReplacementWallet,
  WalletRecoveryError,
  type RecoveryAudit,
  type RecoveryQuery,
  type RecoveryTransaction,
} from '../services/wallet-recovery.service.js';

const USER_LIMIT = 5;
const USER_WINDOW_SEC = 10 * 60;
const IP_LIMIT = 20;
const IP_WINDOW_SEC = 60;

const REQUEST_FIELDS = new Set(['lostWalletId']);
const FACTOR_FIELDS = new Set(['factor', 'challengeId', 'message', 'signature', 'passkeyId', 'assertion', 'totpCode']);
const CHALLENGE_FIELDS = new Set(['caip10', 'action', 'lostWalletId']);
const PROOF_FIELDS = new Set(['challengeId', 'message', 'signature', 'lostWalletId']);
const ACTIONS = new Set([AUTHORIZE_RECOVERY_ACTION, MARK_COMPROMISED_ACTION, REPLACE_WALLET_ACTION]);

function transaction(): RecoveryTransaction {
  return (fn) => db.transaction(async (client) => fn(async (sql, params) => {
    const result = await client.query(sql, params);
    return { rows: result.rows as Array<Record<string, unknown>> };
  }));
}

function query(): RecoveryQuery {
  return async (sql, params) => {
    const result = await db.query(sql, params);
    return { rows: result.rows as Array<Record<string, unknown>> };
  };
}

function userIdOf(request: FastifyRequest): string | null {
  const id = request.user?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function hasExtra(body: unknown, allowed: Set<string>): boolean {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.keys(body as Record<string, unknown>).some((key) => !allowed.has(key));
}

function rejectExtra(reply: FastifyReply) {
  return reply.status(400).send({
    success: false,
    error: { code: 'INVALID_REQUEST', message: 'Invalid request' },
  });
}

function limits(scope: string) {
  return [
    rateLimitByIp(scope, IP_LIMIT, IP_WINDOW_SEC, { failClosed: config.rateLimit.failClosed }),
    rateLimitByUser(scope, USER_LIMIT, USER_WINDOW_SEC, { failClosed: config.rateLimit.failClosed }),
  ];
}

async function audit(request: FastifyRequest, userId: string, event: RecoveryAudit, message?: string): Promise<void> {
  const ip = getClientIp(request);
  const metadata = {
    action: event.action,
    outcome: event.outcome,
    caseId: event.caseId,
    walletId: event.walletId,
    challengeId: event.challengeId,
    messageSha256: message ? messageSha256(message) : undefined,
    actorType: 'user',
    actorId: userId,
  };
  logger.info('Wallet recovery', { userId, ip, action: event.action, outcome: event.outcome, caseId: event.caseId });
  await logUserActivity({
    userId,
    action: 'settings_change',
    sessionId: request.user?.sessionId || null,
    ipAddress: ip,
    userAgent: request.headers['user-agent'],
    deviceId: getDeviceIdFromRequest(request.headers as Record<string, string | undefined>),
    metadata,
  });
}

function sendError(reply: FastifyReply, err: WalletRecoveryError) {
  return reply.status(err.statusCode).send({
    success: false,
    error: { code: err.code, message: err.publicMessage },
  });
}

async function handleFailure(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  err: unknown,
  action: string
) {
  if (reply.sent) return;
  if (err instanceof WalletRecoveryError) {
    await audit(request, userId, { action, outcome: 'failure' });
    return sendError(reply, err);
  }
  logger.error('Wallet recovery failed', {
    userId,
    action,
    pgCode: typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : undefined,
  });
  return reply.status(500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Could not update account recovery. Try again.' },
  });
}

export default async function walletRecoveryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/wallets/recovery', {
    preHandler: [
      app.authenticateUser,
      rateLimitByIp('auth:wallet-recovery-read', 60, 60, { failClosed: config.rateLimit.failClosed }),
      rateLimitByUser('auth:wallet-recovery-read', 60, 60, { failClosed: config.rateLimit.failClosed }),
    ],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    try {
      const recovery = await getRecoveryView({ userId, query: query() });
      return reply.send({ success: true, data: { recovery } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'recovery_requested');
    }
  });

  app.post('/wallets/recovery', {
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, REQUEST_FIELDS)) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-recovery-request')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    const body = (request.body ?? {}) as { lostWalletId?: string };
    try {
      const result = await requestRecovery({
        userId,
        lostWalletId: body.lostWalletId ?? null,
        transaction: transaction(),
      });
      await audit(request, userId, result.audit);
      return reply.send({ success: true, data: { recovery: result.recovery } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'recovery_requested');
    }
  });

  app.post('/wallets/recovery/factor', {
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, FACTOR_FIELDS)) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-recovery-factor')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    const body = (request.body ?? {}) as {
      factor?: 'second_wallet' | 'passkey' | 'totp' | 'email';
      challengeId?: string;
      message?: string;
      signature?: string;
      passkeyId?: string;
      assertion?: unknown;
      totpCode?: string;
    };
    if (body.factor !== 'second_wallet' && body.factor !== 'passkey' && body.factor !== 'totp' && body.factor !== 'email') {
      return rejectExtra(reply);
    }
    try {
      const result = await verifyRecoveryFactor({
        userId,
        factor: body.factor,
        challengeId: body.challengeId,
        message: body.message,
        signature: body.signature,
        passkeyId: body.passkeyId,
        assertion: body.assertion,
        totpCode: body.factor === 'totp' ? body.totpCode : undefined,
        frontendUrl: config.frontendUrl,
        transaction: transaction(),
      });
      await audit(request, userId, result.audit, body.message);
      return reply.send({ success: true, data: { recovery: result.recovery } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'recovery_factor_verified');
    }
  });

  app.post('/wallets/recovery/challenge', {
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, CHALLENGE_FIELDS)) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-recovery-challenge')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    const body = (request.body ?? {}) as { caip10?: string; action?: string; lostWalletId?: string };
    if (!body.action || !ACTIONS.has(body.action)) return rejectExtra(reply);
    try {
      const challenge = await createRecoveryChallenge({
        userId,
        caip10: body.caip10 ?? '',
        action: body.action as typeof AUTHORIZE_RECOVERY_ACTION,
        lostWalletId: body.lostWalletId ?? null,
        frontendUrl: config.frontendUrl,
        transaction: transaction(),
      });
      return reply.send({ success: true, challenge });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'recovery_factor_verified');
    }
  });

  app.post('/wallets/recovery/compromise', {
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, PROOF_FIELDS)) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-recovery-compromise')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    const body = (request.body ?? {}) as {
      challengeId?: string;
      message?: string;
      signature?: string;
      lostWalletId?: string;
    };
    try {
      const result = await markWalletCompromised({
        userId,
        lostWalletId: body.lostWalletId ?? '',
        challengeId: body.challengeId ?? '',
        message: body.message ?? '',
        signature: body.signature ?? '',
        frontendUrl: config.frontendUrl,
        sessionId: request.user?.sessionId ?? null,
        transaction: transaction(),
      });
      await audit(request, userId, result.audit, body.message);
      return reply.send({ success: true, data: { walletId: result.audit.walletId } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'wallet_marked_compromised');
    }
  });

  app.post('/wallets/recovery/replace', {
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, new Set(['challengeId', 'message', 'signature']))) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-recovery-replace')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    const body = (request.body ?? {}) as { challengeId?: string; message?: string; signature?: string };
    try {
      const result = await verifyReplacementWallet({
        userId,
        challengeId: body.challengeId ?? '',
        message: body.message ?? '',
        signature: body.signature ?? '',
        frontendUrl: config.frontendUrl,
        sessionId: request.user?.sessionId ?? null,
        transaction: transaction(),
      });
      await audit(request, userId, result.audit, body.message);
      return reply.send({ success: true, data: { walletId: result.walletId } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'recovery_cooldown_started');
    }
  });

  app.post('/wallets/recovery/complete', {
    preHandler: [app.authenticateUser, ...limits('auth:wallet-recovery-complete')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    try {
      const result = await completeRecoveryCooldown({ userId, transaction: transaction() });
      await audit(request, userId, result.audit);
      return reply.send({ success: true, data: { walletId: result.walletId } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'recovery_completed');
    }
  });

  app.post('/wallets/recovery/cancel', {
    preHandler: [app.authenticateUser, ...limits('auth:wallet-recovery-cancel')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    try {
      const result = await cancelRecovery({ userId, transaction: transaction() });
      await audit(request, userId, result.audit);
      return reply.send({ success: true, data: { cancelled: true } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'recovery_cancelled');
    }
  });

  app.post('/wallets/recovery/review', {
    preHandler: [app.authenticateUser, ...limits('auth:wallet-recovery-review')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    try {
      const result = await submitTotpForReview({ userId, transaction: transaction() });
      await audit(request, userId, result.audit);
      return reply.send({ success: true, data: { submitted: true } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'recovery_review_started');
    }
  });

  app.post('/wallets/recovery/email-link', {
    preHandler: [
      rateLimitByIp('auth:wallet-recovery-email', IP_LIMIT, IP_WINDOW_SEC, { failClosed: config.rateLimit.failClosed }),
      app.authenticateUser,
      rateLimitByUser('auth:wallet-recovery-email', USER_LIMIT, USER_WINDOW_SEC, { failClosed: config.rateLimit.failClosed }),
    ],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    try {
      assertEmailCannotLinkWallet();
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'recovery_requested');
    }
  });
}
