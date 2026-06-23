/**
 * Admin fiat (INR) withdrawal review + settlement. Mounted at /api/v1/admin.
 * Admin JWT required. Approve/complete/reject the manual (admin-settled) payouts
 * and manually credit a user's INR balance (the funding rail until a fiat
 * deposit/payout provider goes live).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAdminFromRequest } from './admin.fastify.js';
import { logAuditFromRequest } from '../services/audit-log.service.js';
import { fiatWithdrawalService, FiatWithdrawalError } from '../services/fiat-withdrawal.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendErr(reply: FastifyReply, e: unknown) {
  if (e instanceof FiatWithdrawalError) {
    return reply.status(e.http).send({ success: false, error: { code: e.code, message: e.message } });
  }
  return reply.status(500).send({ success: false, error: { code: 'FIAT_ADMIN_FAILED', message: 'Operation failed' } });
}

export default async function adminFiatRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { status?: string; limit?: string; offset?: string } }>(
    '/fiat-withdrawals',
    async (request, reply) => {
      const admin = await getAdminFromRequest(app, request, reply, false);
      if (!admin) return;
      try {
        const { status, limit, offset } = request.query;
        const data = await fiatWithdrawalService.adminList({
          status: status && status !== 'all' ? status : undefined,
          limit: limit ? parseInt(limit, 10) : 50,
          offset: offset ? parseInt(offset, 10) : 0,
        });
        return reply.send({ success: true, data: data.rows, total: data.total });
      } catch (e) {
        return sendErr(reply, e);
      }
    }
  );

  app.post<{ Params: { id: string }; Body: { notes?: string } }>(
    '/fiat-withdrawals/:id/approve',
    async (request, reply) => {
      const admin = await getAdminFromRequest(app, request, reply, false);
      if (!admin) return;
      try {
        if (!UUID_RE.test(request.params.id)) {
          return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } });
        }
        const w = await fiatWithdrawalService.adminApprove(admin.adminId, request.params.id, request.body?.notes);
        await logAuditFromRequest(request, { actorType: 'admin', actorId: admin.adminId, action: 'fiat_withdrawal_approved', resourceType: 'fiat_withdrawal', resourceId: request.params.id });
        return reply.send({ success: true, data: w });
      } catch (e) {
        return sendErr(reply, e);
      }
    }
  );

  app.post<{ Params: { id: string }; Body: { providerReference?: string } }>(
    '/fiat-withdrawals/:id/complete',
    async (request, reply) => {
      const admin = await getAdminFromRequest(app, request, reply, false);
      if (!admin) return;
      try {
        if (!UUID_RE.test(request.params.id)) {
          return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } });
        }
        const w = await fiatWithdrawalService.adminComplete(admin.adminId, request.params.id, request.body?.providerReference);
        await logAuditFromRequest(request, { actorType: 'admin', actorId: admin.adminId, action: 'fiat_withdrawal_completed', resourceType: 'fiat_withdrawal', resourceId: request.params.id });
        return reply.send({ success: true, data: w });
      } catch (e) {
        return sendErr(reply, e);
      }
    }
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/fiat-withdrawals/:id/reject',
    async (request, reply) => {
      const admin = await getAdminFromRequest(app, request, reply, false);
      if (!admin) return;
      try {
        if (!UUID_RE.test(request.params.id)) {
          return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } });
        }
        const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : '';
        if (!reason) {
          return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Rejection reason is required' } });
        }
        const w = await fiatWithdrawalService.adminReject(admin.adminId, request.params.id, reason.slice(0, 500));
        await logAuditFromRequest(request, { actorType: 'admin', actorId: admin.adminId, action: 'fiat_withdrawal_rejected', resourceType: 'fiat_withdrawal', resourceId: request.params.id });
        return reply.send({ success: true, data: w });
      } catch (e) {
        return sendErr(reply, e);
      }
    }
  );

  app.post<{ Body: { userId?: string; amount?: string | number; notes?: string } }>(
    '/fiat-credit',
    async (request, reply) => {
      const admin = await getAdminFromRequest(app, request, reply, false);
      if (!admin) return;
      try {
        const userId = typeof request.body?.userId === 'string' ? request.body.userId.trim() : '';
        if (!UUID_RE.test(userId)) {
          return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid userId required' } });
        }
        const amount = request.body?.amount != null ? String(request.body.amount) : '';
        const balance = await fiatWithdrawalService.adminCredit(admin.adminId, userId, amount, request.body?.notes);
        await logAuditFromRequest(request, { actorType: 'admin', actorId: admin.adminId, action: 'fiat_admin_credit', resourceType: 'user', resourceId: userId });
        return reply.send({ success: true, data: balance });
      } catch (e) {
        return sendErr(reply, e);
      }
    }
  );
}
