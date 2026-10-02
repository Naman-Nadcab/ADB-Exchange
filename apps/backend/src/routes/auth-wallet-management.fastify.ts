/**
 * Authenticated wallet management.
 * Identity is request.user.id. The client cannot choose a user id.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';
import { getClientIp } from '../lib/client-ip.js';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { normalizeWalletProvider, type WalletManagementAction } from '../lib/wallet-action-message.js';
import { rateLimitByIp, rateLimitByUser } from '../lib/rate-limit-fastify.js';
import { getDeviceIdFromRequest, logUserActivity } from '../services/activity-monitor.service.js';
import { WalletChallengePersistError } from '../services/wallet-auth-challenge.service.js';
import {
  createWalletLinkChallenge,
  createWalletStepUp,
  listUserWallets,
  setPrimaryWallet,
  unlinkWallet,
  verifyWalletLink,
  WalletManagementError,
  type ManagementQuery,
  type ManagementTransaction,
  type WalletAuditEvent,
} from '../services/wallet-management.service.js';
import { messageSha256 } from '../services/wallet-auth-verify.service.js';

export const WALLET_MANAGE_USER_LIMIT = 10;
export const WALLET_MANAGE_USER_WINDOW_SEC = 10 * 60;
export const WALLET_MANAGE_IP_LIMIT = 30;
export const WALLET_MANAGE_IP_WINDOW_SEC = 60;

const LINK_CHALLENGE_FIELDS = new Set(['caip10', 'provider']);
const PROOF_FIELDS = new Set(['challengeId', 'message', 'signature']);
const STEP_UP_FIELDS = new Set(['action']);

function transaction(): ManagementTransaction {
  return (fn) => db.transaction(async (client) => fn(async (sql, params) => {
    const result = await client.query(sql, params);
    return { rows: result.rows as Array<Record<string, unknown>> };
  }));
}

function query(): ManagementQuery {
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

async function audit(
  request: FastifyRequest,
  userId: string,
  events: WalletAuditEvent[],
  message?: string
): Promise<void> {
  const ip = getClientIp(request);
  const hash = typeof message === 'string' && message.length > 0 && message.length <= 8192
    ? messageSha256(message)
    : undefined;
  for (const event of events) {
    const metadata = {
      action: event.action,
      outcome: event.outcome,
      walletId: event.walletId,
      namespace: event.namespace,
      chainReference: event.chainReference,
      challengeId: event.challengeId ?? undefined,
      messageSha256: hash,
    };
    logger.info('Wallet management', { userId, ip, ...metadata });
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
}

function sendError(reply: FastifyReply, err: WalletManagementError) {
  return reply.status(err.status).send({
    success: false,
    error: { code: err.code, message: err.publicMessage },
  });
}

function limits(scope: string) {
  return [
    rateLimitByIp(scope, WALLET_MANAGE_IP_LIMIT, WALLET_MANAGE_IP_WINDOW_SEC, {
      failClosed: config.rateLimit.failClosed,
    }),
    rateLimitByUser(scope, WALLET_MANAGE_USER_LIMIT, WALLET_MANAGE_USER_WINDOW_SEC, {
      failClosed: config.rateLimit.failClosed,
    }),
  ];
}

export default async function walletManagementRoutes(app: FastifyInstance): Promise<void> {
  app.get('/wallets', {
    preHandler: [
      app.authenticateUser,
      rateLimitByIp('auth:wallet-list', 60, 60, { failClosed: config.rateLimit.failClosed }),
      rateLimitByUser('auth:wallet-list', 60, 60, { failClosed: config.rateLimit.failClosed }),
    ],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    const wallets = await listUserWallets(userId, query());
    return reply.send({ success: true, data: { wallets } });
  });

  app.post('/wallets/link/challenge', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['caip10'],
        properties: {
          caip10: { type: 'string', minLength: 1, maxLength: 256 },
          provider: { type: 'string', minLength: 1, maxLength: 64 },
        },
      },
    },
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, LINK_CHALLENGE_FIELDS)) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-link-challenge')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    const body = request.body as { caip10?: string; provider?: string };
    const provider = body.provider == null ? null : normalizeWalletProvider(body.provider);
    if (body.provider != null && provider == null) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid request' },
      });
    }
    try {
      const challenge = await createWalletLinkChallenge({
        userId,
        caip10: body.caip10 ?? '',
        provider,
        frontendUrl: config.frontendUrl,
        query: query(),
      });
      return reply.send({ success: true, challenge });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'wallet_link');
    }
  });

  app.post('/wallets/link/verify', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['challengeId', 'message', 'signature'],
        properties: {
          challengeId: { type: 'string', minLength: 36, maxLength: 36 },
          message: { type: 'string', minLength: 1, maxLength: 8192 },
          signature: { type: 'string', minLength: 1, maxLength: 256 },
        },
      },
    },
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, PROOF_FIELDS)) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-link-verify')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    const body = request.body as { challengeId: string; message: string; signature: string };
    try {
      const result = await verifyWalletLink({
        userId,
        challengeId: body.challengeId,
        message: body.message,
        signature: body.signature,
        frontendUrl: config.frontendUrl,
        transaction: transaction(),
      });
      await audit(request, userId, result.audit, body.message);
      if (result.alreadyLinked) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'ALREADY_LINKED',
            message: 'This wallet is already linked to your account.',
          },
        });
      }
      return reply.send({ success: true, data: { wallet: result.wallet, alreadyLinked: false } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'wallet_link', body.message);
    }
  });

  app.post<{ Params: { id: string }; Body: { action: WalletManagementAction } }>('/wallets/:id/step-up', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 36, maxLength: 36 } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['set_primary_wallet', 'unlink_wallet'] },
        },
      },
    },
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, STEP_UP_FIELDS)) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-step-up')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    try {
      const challenge = await createWalletStepUp({
        userId,
        walletId: request.params.id,
        action: request.body.action,
        frontendUrl: config.frontendUrl,
        transaction: transaction(),
      });
      return reply.send({ success: true, challenge });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'wallet_step_up_failure');
    }
  });

  app.post<{
    Params: { id: string };
    Body: { challengeId: string; message: string; signature: string };
  }>('/wallets/:id/primary', {
    schema: proofSchema(),
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, PROOF_FIELDS)) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-primary')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    try {
      const result = await setPrimaryWallet({
        userId,
        walletId: request.params.id,
        challengeId: request.body.challengeId,
        message: request.body.message,
        signature: request.body.signature,
        frontendUrl: config.frontendUrl,
        transaction: transaction(),
      });
      await audit(request, userId, result.audit, request.body.message);
      return reply.send({ success: true, data: { wallet: result.wallet } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'wallet_set_primary', request.body?.message);
    }
  });

  app.post<{
    Params: { id: string };
    Body: { challengeId: string; message: string; signature: string };
  }>('/wallets/:id/unlink', {
    schema: proofSchema(),
    preValidation: async (request, reply) => {
      if (hasExtra(request.body, PROOF_FIELDS)) return rejectExtra(reply);
    },
    preHandler: [app.authenticateUser, ...limits('auth:wallet-unlink')],
  }, async (request, reply) => {
    const userId = userIdOf(request);
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    try {
      const result = await unlinkWallet({
        userId,
        walletId: request.params.id,
        challengeId: request.body.challengeId,
        message: request.body.message,
        signature: request.body.signature,
        frontendUrl: config.frontendUrl,
        transaction: transaction(),
      });
      await audit(request, userId, result.audit, request.body.message);
      return reply.send({ success: true, data: { wallet: result.wallet } });
    } catch (err) {
      return handleFailure(request, reply, userId, err, 'wallet_unlink', request.body?.message);
    }
  });
}

function proofSchema() {
  return {
    params: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', minLength: 36, maxLength: 36 } },
    },
    body: {
      type: 'object',
      additionalProperties: false,
      required: ['challengeId', 'message', 'signature'],
      properties: {
        challengeId: { type: 'string', minLength: 36, maxLength: 36 },
        message: { type: 'string', minLength: 1, maxLength: 8192 },
        signature: { type: 'string', minLength: 1, maxLength: 256 },
      },
    },
  };
}

async function handleFailure(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  err: unknown,
  action: WalletAuditEvent['action'],
  message?: string
) {
  if (reply.sent) return;
  if (err instanceof WalletManagementError) {
    const failure: WalletAuditEvent = {
      action,
      outcome: 'failure',
      walletId: err.walletId,
      namespace: err.namespace,
      chainReference: err.chainReference,
      challengeId: err.challengeId,
    };
    const proofFailed = err.code === 'INVALID_SIGNATURE'
      || err.code === 'ACTION_MISMATCH'
      || err.code === 'INVALID_CHALLENGE'
      || err.code === 'CHALLENGE_EXPIRED'
      || err.code === 'CHALLENGE_UNAVAILABLE';
    const events = proofFailed && (action === 'wallet_set_primary' || action === 'wallet_unlink')
      ? [{ ...failure, action: 'wallet_step_up_failure' as const }, failure]
      : [failure];
    await audit(request, userId, events, message);
    return sendError(reply, err);
  }
  if (err instanceof WalletChallengePersistError) {
    logger.error('Wallet management challenge persist failed', { userId });
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Could not update sign-in wallets. Try again.' },
    });
  }
  logger.error('Wallet management failed', {
    userId,
    outcome: 'error',
    pgCode: typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : undefined,
  });
  return reply.status(500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Could not update sign-in wallets. Try again.' },
  });
}
