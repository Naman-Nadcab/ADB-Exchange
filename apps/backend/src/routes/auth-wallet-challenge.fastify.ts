/**
 * POST /api/v1/auth/wallet/challenge
 * Unauthenticated. Returns a server-generated SIWE/SIWS message and nonce.
 * Does not verify a signature, create a user, link a wallet, or open a session.
 */

import type { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';
import { parseCaip10, CaipParseError } from '../lib/caip10.js';
import { getClientIp } from '../lib/client-ip.js';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { rateLimitByIdentifier, rateLimitByIp } from '../lib/rate-limit-fastify.js';
import {
  createWalletAuthChallenge,
  WalletChallengeConfigError,
  WalletChallengePersistError,
} from '../services/wallet-auth-challenge.service.js';

export const WALLET_CHALLENGE_IP_LIMIT = 10;
export const WALLET_CHALLENGE_IP_WINDOW_SEC = 60;
export const WALLET_CHALLENGE_ADDRESS_LIMIT = 5;
export const WALLET_CHALLENGE_ADDRESS_WINDOW_SEC = 10 * 60;

function validationError(err: CaipParseError): { code: string; message: string } {
  if (err.code === 'UNSUPPORTED_NAMESPACE') {
    return { code: 'UNSUPPORTED_WALLET', message: 'Unsupported wallet account' };
  }
  return { code: 'INVALID_ACCOUNT', message: 'Invalid wallet account' };
}

export default async function walletChallengeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preValidation', async (request, reply) => {
    const body = request.body;
    if (body == null || typeof body !== 'object' || Array.isArray(body)) return;
    const extra = Object.keys(body as Record<string, unknown>).filter((key) => key !== 'caip10');
    if (extra.length === 0) return;
    logger.info('Wallet auth challenge rejected', {
      code: 'INVALID_ACCOUNT',
      ip: getClientIp(request),
      outcome: 'rejected',
    });
    return reply.status(400).send({
      success: false,
      error: { code: 'INVALID_ACCOUNT', message: 'Invalid wallet account' },
    });
  });

  app.post<{ Body: { caip10: string } }>('/wallet/challenge', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['caip10'],
        properties: {
          caip10: { type: 'string', minLength: 1, maxLength: 256 },
        },
      },
    },
    preHandler: [
      rateLimitByIp('auth:wallet-challenge', WALLET_CHALLENGE_IP_LIMIT, WALLET_CHALLENGE_IP_WINDOW_SEC, {
        failClosed: config.rateLimit.failClosed,
      }),
      rateLimitByIdentifier(
        'auth:wallet-challenge',
        WALLET_CHALLENGE_ADDRESS_LIMIT,
        WALLET_CHALLENGE_ADDRESS_WINDOW_SEC,
        (req) => {
          const body = req.body as { caip10?: string } | undefined;
          if (!body?.caip10 || typeof body.caip10 !== 'string') return null;
          try {
            return parseCaip10(body.caip10).normalizedAddress;
          } catch {
            return null;
          }
        },
        { failClosed: config.rateLimit.failClosed, preserveCase: true }
      ),
    ],
  }, async (request, reply) => {
    try {
      const challenge = await createWalletAuthChallenge({
        caip10: request.body.caip10,
        frontendUrl: config.frontendUrl,
        query: (sql, params) => db.query(sql, params),
      });
      logger.info('Wallet auth challenge issued', {
        challengeId: challenge.id,
        namespace: challenge.namespace,
        chainReference: challenge.chainReference,
        normalizedAddress: challenge.normalizedAddress,
        ip: getClientIp(request),
        outcome: 'success',
      });
      return reply.status(200).send({
        success: true,
        challenge: {
          id: challenge.id,
          namespace: challenge.namespace,
          chainReference: challenge.chainReference,
          address: challenge.address,
          message: challenge.message,
          nonce: challenge.nonce,
          expiresAt: challenge.expiresAt,
        },
      });
    } catch (err) {
      if (err instanceof CaipParseError) {
        const error = validationError(err);
        logger.info('Wallet auth challenge rejected', {
          code: error.code,
          ip: getClientIp(request),
          outcome: 'rejected',
        });
        return reply.status(400).send({ success: false, error });
      }
      const kind = err instanceof WalletChallengeConfigError
        ? 'origin'
        : err instanceof WalletChallengePersistError
          ? 'persist'
          : 'database';
      logger.error('Wallet auth challenge failed', {
        kind,
        ip: getClientIp(request),
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
