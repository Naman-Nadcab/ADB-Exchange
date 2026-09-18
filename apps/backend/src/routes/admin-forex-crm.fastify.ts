/**
 * Admin Forex CRM — Client 360, notes, leads (operational CRM layer).
 */
import type { FastifyInstance } from 'fastify';
import { getAdminFromRequest, getAdminWithPermission } from './admin.fastify.js';
import { logAuditFromRequest } from '../services/audit-log.service.js';
import { buildForexAdminClient360 } from '../services/forex/admin/crm-client-360.js';
import { createForexCrmNote, listForexCrmNotes } from '../services/forex/admin/crm-notes.js';
import {
  assignForexCrmLead,
  convertForexCrmLead,
  createForexCrmLead,
  getForexCrmLeadDetail,
  listForexCrmLeadStages,
  listForexCrmLeads,
  summarizeForexCrmLeads,
  updateForexCrmLeadFields,
  updateForexCrmLeadStage,
} from '../services/forex/admin/crm-leads.js';
import {
  completeForexCrmTask,
  createForexCrmTask,
  listForexCrmTasks,
  reassignForexCrmTask,
} from '../services/forex/admin/crm-tasks.js';
import { buildForexCrmHomeSnapshot } from '../services/forex/admin/crm-home.js';
import { buildForexCrmWorkspaceSnapshot } from '../services/forex/admin/crm-workspace.js';
import { getForexCrmSegmentDetail, listForexCrmSegments } from '../services/forex/admin/crm-segments.js';
import { db } from '../lib/database.js';

export default async function adminForexCrmRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { accountId: string } }>('/forex/crm/clients/:accountId/360', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await buildForexAdminClient360(request.params.accountId, admin.role);
    if (!data) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Forex account not found' } });
    }
    return reply.send({ success: true, data });
  });

  app.get<{ Params: { accountId: string }; Querystring: { limit?: string } }>(
    '/forex/crm/clients/:accountId/notes',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
      if (!admin) return;
      const limit = Number.parseInt(request.query.limit ?? '50', 10) || 50;
      const notes = await listForexCrmNotes(request.params.accountId, limit);
      return reply.send({ success: true, data: { notes } });
    }
  );

  app.post<{ Params: { accountId: string }; Body: { body?: string; visibility?: string; user_id?: string } }>(
    '/forex/crm/clients/:accountId/notes',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:manage');
      if (!admin) return;
      const visibility = (request.body?.visibility ?? 'internal') as 'internal' | 'compliance' | 'sales';
      if (!['internal', 'compliance', 'sales'].includes(visibility)) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_VISIBILITY', message: 'Invalid visibility' } });
      }
      try {
        const note = await createForexCrmNote({
          accountId: request.params.accountId,
          userId: request.body?.user_id,
          body: String(request.body?.body ?? ''),
          visibility,
          adminId: admin.adminId,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_crm_note_create',
          resourceType: 'forex_crm_note',
          resourceId: note.note_id,
          oldValue: null,
          newValue: { account_id: note.account_id, visibility: note.visibility },
        });
        return reply.send({ success: true, data: { note } });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'CREATE_FAILED';
        const status = code === 'ACCOUNT_NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Failed to create note' } });
      }
    }
  );

  app.get<{ Querystring: Record<string, string | undefined> }>(
    '/forex/crm/leads/summary',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
      if (!admin) return;
      const summary = await summarizeForexCrmLeads(request.query);
      return reply.send({ success: true, data: summary });
    },
  );

  app.get<{ Querystring: { page?: string; limit?: string; stage_id?: string; status?: string } }>(
    '/forex/crm/leads',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
      if (!admin) return;
      const data = await listForexCrmLeads(request.query);
      return reply.send({ success: true, data });
    }
  );

  app.get('/forex/crm/leads/stages', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const stages = await listForexCrmLeadStages();
    return reply.send({ success: true, data: { stages } });
  });

  app.post<{ Body: Record<string, unknown> }>('/forex/crm/leads', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:manage');
    if (!admin) return;
    const body = request.body ?? {};
    try {
      const lead = await createForexCrmLead({
        email: body.email != null ? String(body.email) : undefined,
        phone: body.phone != null ? String(body.phone) : undefined,
        full_name: body.full_name != null ? String(body.full_name) : undefined,
        stage_id: body.stage_id != null ? String(body.stage_id) : undefined,
        campaign_code: body.campaign_code != null ? String(body.campaign_code) : undefined,
        owner_admin_id: body.owner_admin_id != null ? String(body.owner_admin_id) : undefined,
        adminId: admin.adminId,
      });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_crm_lead_create',
        resourceType: 'forex_crm_lead',
        resourceId: lead.lead_id,
        oldValue: null,
        newValue: { stage_id: lead.stage_id, email: lead.email },
      });
      return reply.send({ success: true, data: { lead } });
    } catch (e) {
      return reply.status(400).send({
        success: false,
        error: { code: 'CREATE_FAILED', message: e instanceof Error ? e.message : 'Failed' },
      });
    }
  });

  app.patch<{ Params: { leadId: string }; Body: { owner_admin_id?: string; reason?: string } }>(
    '/forex/crm/leads/:leadId/assign',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:manage');
      if (!admin) return;
      const owner = (request.body?.owner_admin_id ?? '').trim();
      const reason = (request.body?.reason ?? '').trim();
      if (!owner || reason.length < 8) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BODY', message: 'owner_admin_id and reason (min 8 chars) required' },
        });
      }
      try {
        await assignForexCrmLead({
          leadId: request.params.leadId,
          ownerAdminId: owner,
          adminId: admin.adminId,
          reason,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_crm_lead_assign',
          resourceType: 'forex_crm_lead',
          resourceId: request.params.leadId,
          oldValue: null,
          newValue: { owner_admin_id: owner, reason },
        });
        return reply.send({ success: true, data: { assigned: true } });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'ASSIGN_FAILED';
        return reply.status(code === 'LEAD_NOT_FOUND' ? 404 : 400).send({
          success: false,
          error: { code, message: 'Assignment failed' },
        });
      }
    }
  );

  app.get<{ Params: { leadId: string } }>('/forex/crm/leads/:leadId', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await getForexCrmLeadDetail(request.params.leadId);
    if (!data) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Lead not found' } });
    return reply.send({ success: true, data });
  });

  app.patch<{ Params: { leadId: string }; Body: { stage_id?: string; reason?: string } }>(
    '/forex/crm/leads/:leadId/stage',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:manage');
      if (!admin) return;
      const stageId = (request.body?.stage_id ?? '').trim();
      const reason = (request.body?.reason ?? '').trim();
      if (!stageId || reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_BODY', message: 'stage_id and reason required' } });
      }
      try {
        await updateForexCrmLeadStage({ leadId: request.params.leadId, stageId, adminId: admin.adminId, reason });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_crm_lead_stage',
          resourceType: 'forex_crm_lead',
          resourceId: request.params.leadId,
          oldValue: null,
          newValue: { stage_id: stageId, reason },
        });
        return reply.send({ success: true, data: { updated: true } });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'UPDATE_FAILED';
        return reply.status(code === 'LEAD_NOT_FOUND' ? 404 : 400).send({ success: false, error: { code, message: 'Stage update failed' } });
      }
    }
  );

  app.patch<{ Params: { leadId: string }; Body: { priority?: string; status?: string; follow_up_at?: string | null } }>(
    '/forex/crm/leads/:leadId',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:manage');
      if (!admin) return;
      try {
        await updateForexCrmLeadFields({
          leadId: request.params.leadId,
          adminId: admin.adminId,
          priority: request.body?.priority,
          status: request.body?.status,
          follow_up_at: request.body?.follow_up_at,
        });
        return reply.send({ success: true, data: { updated: true } });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'UPDATE_FAILED';
        return reply.status(400).send({ success: false, error: { code, message: 'Update failed' } });
      }
    }
  );

  app.post<{ Params: { leadId: string }; Body: { reason?: string; user_id?: string } }>(
    '/forex/crm/leads/:leadId/convert',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:manage');
      if (!admin) return;
      const reason = (request.body?.reason ?? '').trim();
      if (reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason min 8 chars' } });
      }
      try {
        const result = await convertForexCrmLead({
          leadId: request.params.leadId,
          adminId: admin.adminId,
          reason,
          user_id: request.body?.user_id,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_crm_lead_convert',
          resourceType: 'forex_crm_lead',
          resourceId: request.params.leadId,
          oldValue: null,
          newValue: result,
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'CONVERT_FAILED';
        return reply.status(400).send({ success: false, error: { code, message: 'Conversion failed' } });
      }
    }
  );

  app.get<{ Querystring: Record<string, string | undefined> }>('/forex/crm/tasks', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await listForexCrmTasks(request.query);
    return reply.send({ success: true, data });
  });

  app.post<{ Body: Record<string, unknown> }>('/forex/crm/tasks', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:manage');
    if (!admin) return;
    const body = request.body ?? {};
    try {
      const task = await createForexCrmTask({
        title: String(body.title ?? ''),
        task_type: body.task_type != null ? String(body.task_type) : undefined,
        account_id: body.account_id != null ? String(body.account_id) : undefined,
        lead_id: body.lead_id != null ? String(body.lead_id) : undefined,
        owner_admin_id: body.owner_admin_id != null ? String(body.owner_admin_id) : undefined,
        due_at: body.due_at != null ? String(body.due_at) : undefined,
        description: body.description != null ? String(body.description) : undefined,
        adminId: admin.adminId,
      });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_crm_task_create',
        resourceType: 'forex_crm_task',
        resourceId: task.task_id,
        oldValue: null,
        newValue: { title: task.title, lead_id: task.lead_id, account_id: task.account_id },
      });
      return reply.send({ success: true, data: { task } });
    } catch (e) {
      return reply.status(400).send({ success: false, error: { code: 'CREATE_FAILED', message: e instanceof Error ? e.message : 'Failed' } });
    }
  });

  app.post<{ Params: { taskId: string } }>('/forex/crm/tasks/:taskId/complete', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:manage');
    if (!admin) return;
    try {
      await completeForexCrmTask({ taskId: request.params.taskId, adminId: admin.adminId });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_crm_task_complete',
        resourceType: 'forex_crm_task',
        resourceId: request.params.taskId,
        oldValue: null,
        newValue: { status: 'done' },
      });
      return reply.send({ success: true, data: { completed: true } });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'COMPLETE_FAILED';
      return reply.status(code === 'TASK_NOT_FOUND_OR_DONE' ? 404 : 400).send({ success: false, error: { code, message: 'Complete failed' } });
    }
  });

  app.patch<{ Params: { taskId: string }; Body: { owner_admin_id?: string; reason?: string } }>(
    '/forex/crm/tasks/:taskId/assign',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:manage');
      if (!admin) return;
      const owner = (request.body?.owner_admin_id ?? '').trim();
      const reason = (request.body?.reason ?? '').trim();
      if (!owner || reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_BODY', message: 'owner and reason required' } });
      }
      try {
        await reassignForexCrmTask({
          taskId: request.params.taskId,
          ownerAdminId: owner,
          adminId: admin.adminId,
          reason,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_crm_task_reassign',
          resourceType: 'forex_crm_task',
          resourceId: request.params.taskId,
          oldValue: null,
          newValue: { owner_admin_id: owner, reason },
        });
        return reply.send({ success: true, data: { reassigned: true } });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'REASSIGN_FAILED';
        return reply.status(code === 'TASK_NOT_FOUND' ? 404 : 400).send({ success: false, error: { code, message: 'Reassign failed' } });
      }
    }
  );

  app.get('/forex/crm/segments', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const rows = await listForexCrmSegments();
    return reply.send({ success: true, data: { rows, note: 'Predefined segments only — no custom SQL from operators.' } });
  });

  app.get<{ Params: { segmentId: string } }>('/forex/crm/segments/:segmentId', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await getForexCrmSegmentDetail(request.params.segmentId);
    if (!data) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Unknown segment' } });
    }
    return reply.send({ success: true, data });
  });

  app.get('/forex/crm/home', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await buildForexCrmHomeSnapshot();
    return reply.send({ success: true, data });
  });

  app.get('/forex/crm/workspace', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await buildForexCrmWorkspaceSnapshot(admin.adminId);
    return reply.send({ success: true, data });
  });

  app.get<{ Querystring: { limit?: string } }>('/forex/crm/activities/recent', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const limit = Math.min(50, Math.max(1, Number.parseInt(request.query.limit ?? '20', 10) || 20));
    try {
      const res = await db.query(
        `SELECT activity_id, account_id, lead_id, kind, summary, actor_admin_id, created_at
         FROM forex_crm_activities ORDER BY created_at DESC LIMIT $1`,
        [limit],
      );
      return reply.send({ success: true, data: { rows: res.rows } });
    } catch {
      return reply.send({ success: true, data: { rows: [] } });
    }
  });

  app.get('/forex/crm/permissions', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const { listForexPermissionsForRole } = await import('../lib/forex-admin-rbac.js');
    return reply.send({
      success: true,
      data: { role: admin.role, permissions: listForexPermissionsForRole(admin.role) },
    });
  });
}
