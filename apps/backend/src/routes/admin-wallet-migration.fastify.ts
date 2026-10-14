/**
 * Admin-only migration status and cutover control.
 * A customer session cannot set the mode or read another user's status.
 * Responses omit passwords, hashes, OTP, TOTP secrets, keys, and signatures.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getClientIp } from '../lib/client-ip.js';
import { logger } from '../lib/logger.js';
import { getAdminWithPermission } from './admin.fastify.js';
import {
  adminMigrationStatus,
  buildMigrationReadiness,
  CutoverRefused,
  isCutoverMode,
  setCutoverMode,
  type CutoverMode,
} from '../services/legacy-auth-policy.service.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIp(request: FastifyRequest): string | null {
  return getClientIp(request);
}

export default async function adminWalletMigrationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/wallet-migration/readiness', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'monitoring:view');
    if (!admin) return;
    try {
      const report = await buildMigrationReadiness();
      return reply.send({ success: true, data: report });
    } catch (error) {
      logger.error('Wallet migration readiness failed', {
        adminId: admin.adminId,
        ip: clientIp(request),
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Could not build the migration report.' },
      });
    }
  });

  app.get<{ Params: { userId: string } }>('/wallet-migration/status/:userId', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'monitoring:view');
    if (!admin) return;
    const userId = request.params.userId;
    if (!UUID_PATTERN.test(userId)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid request' },
      });
    }
    try {
      const status = await adminMigrationStatus(userId);
      if (!status) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }
      return reply.send({ success: true, data: status });
    } catch (error) {
      logger.error('Wallet migration status failed', {
        adminId: admin.adminId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Could not read migration status.' },
      });
    }
  });

  app.post<{ Body: { mode?: string } }>('/wallet-migration/mode', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'settings:edit');
    if (!admin) return;
    const mode = request.body?.mode;
    if (!isCutoverMode(mode)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid cutover mode' },
      });
    }
    try {
      const applied = await setCutoverMode(mode as CutoverMode, admin.adminId);
      return reply.send({ success: true, data: { mode: applied } });
    } catch (error) {
      if (error instanceof CutoverRefused) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'CUTOVER_REFUSED',
            message: 'Wallet-first cutover refused',
            failed: error.failed,
          },
        });
      }
      logger.error('Wallet cutover mode change failed', {
        adminId: admin.adminId,
        ip: clientIp(request),
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return reply.status(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Could not update the cutover mode.' },
      });
    }
  });
}
