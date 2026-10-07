/**
 * POST /api/v1/auth/wallet/verify
 * Unauthenticated. Verifies a signature over a server-issued challenge.
 * Does not create a user, link a wallet, issue a JWT, or set a cookie.
 */

import type { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';
import { getClientIp } from '../lib/client-ip.js';
import { walletFrontendUrl } from '../lib/wallet-frontend-url.js';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { rateLimitByIdentifier, rateLimitByIp, replyToRateLimit, takeRateLimitSlot } from '../lib/rate-limit-fastify.js';
import {
  messageSha256,
  verifyWalletAuthChallenge,
  WalletVerifyError,
  WalletVerifyRateLimited,
} from '../services/wallet-auth-verify.service.js';

export const WALLET_VERIFY_IP_LIMIT = 10;
export const WALLET_VERIFY_IP_WINDOW_SEC = 60;
export const WALLET_VERIFY_CHALLENGE_LIMIT = 10;
export const WALLET_VERIFY_CHALLENGE_WINDOW_SEC = 10 * 60;
export const WALLET_VERIFY_ADDRESS_LIMIT = 10;
export const WALLET_VERIFY_ADDRESS_WINDOW_SEC = 10 * 60;

const ALLOWED_FIELDS = new Set(['challengeId', 'message', 'signature']);

function clientError(code: WalletVerifyError['code']): { status: number; message: string } {
  if (code === 'CHALLENGE_EXPIRED') return { status: 400, message: 'Expired challenge' };
  if (code === 'CHALLENGE_UNAVAILABLE') return { status: 400, message: 'Challenge unavailable' };
  if (code === 'INVALID_SIGNATURE') return { status: 400, message: 'Invalid signature' };
  return { status: 400, message: 'Invalid challenge' };
}

async function enforceAddressLimit(normalizedAddress: string): Promise<void> {
  const slot = await takeRateLimitSlot(
    'auth:wallet-verify',
    `id:${normalizedAddress}`,
    WALLET_VERIFY_ADDRESS_LIMIT,
    WALLET_VERIFY_ADDRESS_WINDOW_SEC,
    config.rateLimit.failClosed
  );
  if (!slot.allowed) throw new WalletVerifyRateLimited(slot.unavailable, `id:${normalizedAddress}`);
}

export default async function walletVerifyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', async (request, reply) => {
    const body = request.body;
    if (body == null || typeof body !== 'object' || Array.isArray(body)) return;
    const extra = Object.keys(body as Record<string, unknown>).filter((key) => !ALLOWED_FIELDS.has(key));
    if (extra.length === 0) return;
    logger.info('Wallet auth verification rejected', {
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
  }>('/wallet/verify', {
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
      rateLimitByIp('auth:wallet-verify', WALLET_VERIFY_IP_LIMIT, WALLET_VERIFY_IP_WINDOW_SEC, {
        failClosed: config.rateLimit.failClosed,
      }),
      rateLimitByIdentifier(
        'auth:wallet-verify',
        WALLET_VERIFY_CHALLENGE_LIMIT,
        WALLET_VERIFY_CHALLENGE_WINDOW_SEC,
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
    try {
      const result = await verifyWalletAuthChallenge({
        challengeId,
        message,
        signature,
        frontendUrl: walletFrontendUrl(request.headers.origin),
        transaction: (fn) => db.transaction((client) => fn((sql, params) => client.query(sql, params))),
        beforeSignature: (row) => enforceAddressLimit(row.normalizedAddress),
      });
      logger.info('Wallet auth verification succeeded', {
        challengeId: result.challengeId,
        namespace: result.wallet.namespace,
        chainReference: result.wallet.chainReference,
        normalizedAddress: result.normalizedAddress,
        messageSha256: messageSha256(message),
        ip,
        outcome: 'success',
      });
      return reply.status(200).send({
        success: true,
        verified: true,
        wallet: result.wallet,
        challengeId: result.challengeId,
      });
    } catch (err) {
      if (reply.sent) return;
      if (err instanceof WalletVerifyRateLimited) {
        replyToRateLimit(reply, 'auth:wallet-verify', err.identifier, err.unavailable);
        return;
      }
      if (err instanceof WalletVerifyError) {
        const error = clientError(err.code);
        logger.info('Wallet auth verification rejected', {
          challengeId: err.challengeId,
          namespace: err.namespace,
          chainReference: err.chainReference,
          normalizedAddress: err.normalizedAddress,
          messageSha256: messageSha256(message),
          code: err.code,
          ip,
          outcome: 'rejected',
        });
        return reply.status(error.status).send({
          success: false,
          verified: false,
          error: { code: err.code, message: error.message },
        });
      }
      logger.error('Wallet auth verification failed', {
        challengeId,
        messageSha256: messageSha256(message),
        ip,
        outcome: 'error',
        pgCode: typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : undefined,
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  });
}
