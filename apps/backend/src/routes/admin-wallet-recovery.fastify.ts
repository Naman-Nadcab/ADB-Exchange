/**
 * Admin-assisted wallet recovery.
 * Requires an admin session and kyc:review. A customer wallet signature is not admin authentication.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getClientIp } from '../lib/client-ip.js';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';
import { getAdminWithPermission } from './admin.fastify.js';
import { getDeviceIdFromRequest, logAdminActivity } from '../services/activity-monitor.service.js';
import {
  adminDecide,
  adminOpenReview,
  WalletRecoveryError,
  type RecoveryTransaction,
} from '../services/wallet-recovery.service.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function transaction(): RecoveryTransaction {
  return (fn) => db.transaction(async (client) => fn(async (sql, params) => {
    const result = await client.query(sql, params);
    return { rows: result.rows as Array<Record<string, unknown>> };
  }));
}

function sendError(reply: FastifyReply, err: WalletRecoveryError) {
  return reply.status(err.statusCode).send({
    success: false,
    error: { code: err.code, message: err.publicMessage },
  });
}

async function record(
  request: FastifyRequest,
  adminId: string,
  action: string,
  userId: string,
  outcome: 'success' | 'failure'
): Promise<void> {
  await logAdminActivity({
    adminId,
    action: 'wallet_recovery',
    ipAddress: getClientIp(request),
    userAgent: request.headers['user-agent'],
    deviceId: getDeviceIdFromRequest(request.headers as Record<string, string | undefined>),
    metadata: { action, outcome, userId, actorType: 'admin', actorId: adminId },
  });
}

export default async function adminWalletRecoveryRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { userId: string }; Body: { reason?: string } }>('/wallet-recovery/:userId/review', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'kyc:review');
    if (!admin) return;
    const userId = request.params.userId;
    if (!UUID_PATTERN.test(userId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid request' },
      });
    }
    try {
      const result = await adminOpenReview({
        userId,
        adminId: admin.adminId,
        reason: request.body?.reason ?? '',
        transaction: transaction(),
      });
      await record(request, admin.adminId, result.audit.action, userId, 'success');
      return reply.send({ success: true, data: { approvalRequestId: result.approvalRequestId } });
    } catch (err) {
      await record(request, admin.adminId, 'recovery_review_started', userId, 'failure');
      if (err instanceof WalletRecoveryError) return sendError(reply, err);
      logger.error('Admin wallet recovery review failed', { userId, adminId: admin.adminId });
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Could not open recovery review.' },
      });
    }
  });

  app.post<{ Params: { userId: string }; Body: { decision?: string; reason?: string } }>(
    '/wallet-recovery/:userId/decide',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'kyc:review');
      if (!admin) return;
      const userId = request.params.userId;
      const decision = request.body?.decision;
      if (!UUID_PATTERN.test(userId) || (decision !== 'approve' && decision !== 'reject')) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Invalid request' },
        });
      }
      try {
        const result = await adminDecide({
          userId,
          adminId: admin.adminId,
          decision,
          reason: request.body?.reason,
          transaction: transaction(),
        });
        await record(request, admin.adminId, result.audit.action, userId, 'success');
        return reply.send({ success: true, data: { decision } });
      } catch (err) {
        await record(request, admin.adminId, decision === 'approve' ? 'recovery_approved' : 'recovery_rejected', userId, 'failure');
        if (err instanceof WalletRecoveryError) return sendError(reply, err);
        logger.error('Admin wallet recovery decision failed', { userId, adminId: admin.adminId });
        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Could not decide this recovery.' },
        });
      }
    }
  );
}
