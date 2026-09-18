/**
 * Admin Forex account groups — CRUD and account assignment (control plane).
 */
import type { FastifyInstance } from 'fastify';
import { getAdminWithPermission } from './admin.fastify.js';
import { logAuditFromRequest } from '../services/audit-log.service.js';
import {
  createForexAccountGroup,
  forexAccountExists,
  listForexAccountGroups,
  updateForexAccountGroup,
} from '../services/forex/admin/account-groups.js';
import { createForexAdminApprovalRequest } from '../services/forex/admin/forex-admin-approval-entry.js';

export default async function adminForexGroupsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/forex/account-groups', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:accounts:view');
    if (!admin) return;
    const groups = await listForexAccountGroups();
    return reply.send({ success: true, data: { groups } });
  });

  app.post<{ Body: Record<string, unknown> }>('/forex/account-groups', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:accounts:manage');
    if (!admin) return;
    const body = request.body ?? {};
    try {
      const group = await createForexAccountGroup({
        code: String(body.code ?? ''),
        label: String(body.label ?? ''),
        leverage_default: body.leverage_default != null ? String(body.leverage_default) : undefined,
        position_mode_default: body.position_mode_default as 'NETTING' | 'HEDGING' | undefined,
      });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_account_group_create',
        resourceType: 'forex_account_group',
        resourceId: group.group_id,
        oldValue: null,
        newValue: { code: group.code, label: group.label },
      });
      return reply.send({ success: true, data: { group } });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'CREATE_FAILED';
      return reply.status(400).send({ success: false, error: { code, message: 'Create failed' } });
    }
  });

  app.patch<{ Params: { groupId: string }; Body: Record<string, unknown> }>(
    '/forex/account-groups/:groupId',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:accounts:manage');
      if (!admin) return;
      const body = request.body ?? {};
      try {
        const group = await updateForexAccountGroup(request.params.groupId, {
          label: body.label != null ? String(body.label) : undefined,
          leverage_default: body.leverage_default != null ? String(body.leverage_default) : undefined,
          is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_account_group_update',
          resourceType: 'forex_account_group',
          resourceId: group.group_id,
          oldValue: null,
          newValue: { label: group.label, is_active: group.is_active },
        });
        return reply.send({ success: true, data: { group } });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'UPDATE_FAILED';
        return reply.status(code === 'GROUP_NOT_FOUND' ? 404 : 400).send({
          success: false,
          error: { code, message: 'Update failed' },
        });
      }
    }
  );

  app.post<{ Params: { accountId: string }; Body: { group_id?: string; reason?: string } }>(
    '/forex/accounts/:accountId/group',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:accounts:manage');
      if (!admin) return;
      const groupId = (request.body?.group_id ?? '').trim();
      const reason = (request.body?.reason ?? '').trim();
      if (!groupId || reason.length < 8) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BODY', message: 'group_id and reason (min 8 chars) required' },
        });
      }
      try {
        if (!(await forexAccountExists(request.params.accountId))) {
          return reply.status(404).send({
            success: false,
            error: { code: 'ACCOUNT_NOT_FOUND', message: 'Forex account not found' },
          });
        }
        const { request: approvalReq, correlationId } = await createForexAdminApprovalRequest({
          actionType: 'forex_account_group_change',
          requestedBy: admin.adminId,
          payload: {
            accountId: request.params.accountId,
            groupId,
            reason,
            executingAdminId: admin.adminId,
            targetResource: 'forex_account',
            targetId: request.params.accountId,
          },
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'admin_approval_request_create',
          resourceType: 'admin_approval_request',
          resourceId: approvalReq.id,
          oldValue: null,
          newValue: {
            action_type: 'forex_account_group_change',
            account_id: request.params.accountId,
            group_id: groupId,
            correlationId,
          },
        });
        return reply.status(202).send({
          success: true,
          data: {
            approval_required: true,
            approval_id: approvalReq.id,
            status: approvalReq.status,
            correlationId,
            note: 'Assignment executes after required approvals (/approvals).',
          },
        });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'ASSIGN_FAILED';
        const status =
          code === 'ACCOUNT_NOT_FOUND' || code === 'GROUP_NOT_FOUND_OR_INACTIVE' ? 404 : code === 'OPEN_POSITIONS_BLOCK_GROUP_CHANGE' ? 409 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Assignment failed' } });
      }
    }
  );

  app.post<{ Params: { accountId: string }; Body: { leverage?: string; reason?: string } }>(
    '/forex/accounts/:accountId/leverage-override',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:accounts:manage');
      if (!admin) return;
      const leverage = (request.body?.leverage ?? '').trim();
      const reason = (request.body?.reason ?? '').trim();
      if (!leverage || reason.length < 8) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BODY', message: 'leverage and reason (min 8 chars) required' },
        });
      }
      try {
        if (!(await forexAccountExists(request.params.accountId))) {
          return reply.status(404).send({
            success: false,
            error: { code: 'ACCOUNT_NOT_FOUND', message: 'Forex account not found' },
          });
        }
        const { request: approvalReq, correlationId } = await createForexAdminApprovalRequest({
          actionType: 'forex_leverage_change',
          requestedBy: admin.adminId,
          payload: {
            accountId: request.params.accountId,
            leverage,
            reason,
            executingAdminId: admin.adminId,
            targetResource: 'forex_account',
            targetId: request.params.accountId,
          },
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'admin_approval_request_create',
          resourceType: 'admin_approval_request',
          resourceId: approvalReq.id,
          oldValue: null,
          newValue: {
            action_type: 'forex_leverage_change',
            account_id: request.params.accountId,
            leverage,
            correlationId,
          },
        });
        return reply.status(202).send({
          success: true,
          data: {
            approval_required: true,
            approval_id: approvalReq.id,
            status: approvalReq.status,
            correlationId,
            note: 'Leverage override persists after approval; margin engine may not apply until wired.',
          },
        });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'UPDATE_FAILED';
        const status =
          code === 'ACCOUNT_NOT_FOUND' ? 404 : code === 'OPEN_POSITIONS_BLOCK_LEVERAGE_CHANGE' ? 409 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Leverage update failed' } });
      }
    }
  );
}
