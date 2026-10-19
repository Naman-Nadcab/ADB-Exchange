/**
 * Forex MT5-class ops plane — dealing actions, notifications, search, finance, automation, compliance.
 */
import type { FastifyInstance } from 'fastify';
import { getAdminWithPermission } from './admin.fastify.js';
import { logAuditFromRequest } from '../services/audit-log.service.js';
import {
  assignDealerToOrder,
  dealerAcceptForexOrder,
  dealerRejectForexOrder,
  escalateDealerOrder,
  listForexDealingActions,
} from '../services/forex/admin/dealing-actions.js';
import { searchForexAdminAudit } from '../services/forex/admin/admin-audit-search.js';
import {
  acknowledgeForexOperatorNotification,
  listForexOperatorNotifications,
  resolveForexOperatorNotification,
} from '../services/forex/admin/operator-notifications.js';
import { searchForexAdmin } from '../services/forex/admin/admin-search.js';
import { createForexFinanceRequest, listForexFinanceRequests } from '../services/forex/admin/finance-requests.js';
import { getForexBookMode, getForexDeskOrderPolicy, setForexBookMode, setForexDeskOrderPolicy } from '../services/forex/admin/desk-policy.js';
import { adminCloseByForexPositions, adminCloseForexPosition, adminModifyForexOrder, adminPlaceForexOrder, adminSetForexProtection, forexAccountStatement } from '../services/forex/admin/manager-desk.js';
import {
  createForexAutomationWorkflow,
  listForexAutomationRuns,
  listForexAutomationWorkflows,
  runForexAutomationWorkflowDryRun,
} from '../services/forex/admin/automation-workflows.js';
import { dispatchForexAutomationEvent, setForexAutomationWorkflowEnabled } from '../services/forex/admin/automation-runtime.js';
import { applyForexBrokerReconciliation, buildForexBrokerReconciliation } from '../services/forex/broker/reconcile.js';
import {
  accrueForexPartnerCommission,
  createForexPartnerPayoutRequest,
  listForexPartnerAccruals,
  listForexPartnerPayoutRequests,
} from '../services/forex/admin/forex-partner-ib.js';
import { accrueForexPartnerVolume, createForexPartnerProfile } from '../services/forex/admin/forex-partners.js';
import {
  createForexSignalProvider,
  listForexSignalProviders,
  setForexSignalProviderStatus,
} from '../services/forex/customer/forex-signals.js';
import {
  assignForexComplianceCase,
  closeForexComplianceCase,
  createForexComplianceCase,
  listForexComplianceCases,
  transitionForexComplianceCaseStatus,
} from '../services/forex/admin/compliance-cases.js';
import { buildForexRiskHubSnapshot } from '../services/forex/admin/risk-hub.js';
import { transitionForexAccountStatus } from '../services/forex/admin/account-lifecycle.js';

function deskErrorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'reason' in e && typeof (e as { reason: unknown }).reason === 'string') {
    return (e as { reason: string }).reason;
  }
  return e instanceof Error ? e.message : 'FAILED';
}

export default async function adminForexOpsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { symbol?: string; account_id?: string } }>('/forex/risk/hub', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:risk:view');
    if (!admin) return;
    const data = await buildForexRiskHubSnapshot(request.query);
    return reply.send({ success: true, data });
  });

  app.post<{ Params: { accountId: string }; Body: { status?: string; reason?: string } }>(
    '/forex/accounts/:accountId/status',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:accounts:manage');
      if (!admin) return;
      try {
        const result = await transitionForexAccountStatus({
          accountId: request.params.accountId,
          nextStatus: String(request.body?.status ?? ''),
          reason: String(request.body?.reason ?? ''),
          adminId: admin.adminId,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_account_status_transition',
          resourceType: 'forex_account',
          resourceId: null,
          oldValue: { account_id: result.account_id, status: result.previous_status },
          newValue: { account_id: result.account_id, status: result.next_status, reason: String(request.body?.reason ?? '') },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'TRANSITION_FAILED';
        const status = code === 'ACCOUNT_NOT_FOUND' ? 404 : code === 'TRANSITION_FORBIDDEN' || code === 'OPEN_EXPOSURE_BLOCKS_CLOSE' ? 409 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Status transition failed' } });
      }
    },
  );

  app.get<{ Querystring: Record<string, string | undefined> }>('/forex/audit/search', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:audit:view');
    if (!admin) return;
    const data = await searchForexAdminAudit({ ...request.query, domain: request.query.domain ?? 'forex' });
    return reply.send({ success: true, data });
  });

  app.post<{ Params: { orderId: string }; Body: { assignee_admin_id?: string; reason?: string } }>(
    '/forex/dealing/orders/:orderId/assign',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:manage');
      if (!admin) return;
      const assignee = String(request.body?.assignee_admin_id ?? '').trim();
      const reason = String(request.body?.reason ?? '').trim();
      if (!assignee || reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_BODY', message: 'assignee and reason required' } });
      }
      try {
        const result = await assignDealerToOrder({
          orderId: request.params.orderId,
          dealerAdminId: admin.adminId,
          assigneeAdminId: assignee,
          reason,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_dealer_assign',
          resourceType: 'forex_order',
          resourceId: null,
          oldValue: null,
          newValue: { order_id: request.params.orderId, ...result },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'ASSIGN_FAILED';
        return reply.status(code === 'ORDER_NOT_FOUND' ? 404 : 400).send({ success: false, error: { code, message: 'Assign failed' } });
      }
    },
  );

  app.post<{ Params: { orderId: string }; Body: { escalation_admin_id?: string; reason?: string } }>(
    '/forex/dealing/orders/:orderId/escalate',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:manage');
      if (!admin) return;
      const escalation = String(request.body?.escalation_admin_id ?? '').trim();
      const reason = String(request.body?.reason ?? '').trim();
      if (!escalation || reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_BODY', message: 'escalation_admin_id and reason required' } });
      }
      try {
        const result = await escalateDealerOrder({
          orderId: request.params.orderId,
          dealerAdminId: admin.adminId,
          escalationAdminId: escalation,
          reason,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_dealer_escalate',
          resourceType: 'forex_order',
          resourceId: null,
          oldValue: null,
          newValue: { order_id: request.params.orderId, ...result },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'ESCALATE_FAILED';
        return reply.status(code === 'ORDER_NOT_FOUND' ? 404 : 400).send({ success: false, error: { code, message: 'Escalate failed' } });
      }
    },
  );

  app.get<{ Querystring: { q?: string } }>('/forex/search', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:view');
    if (!admin) return;
    const q = String(request.query.q ?? '').trim();
    const data = await searchForexAdmin(q, admin.role);
    return reply.send({ success: true, data });
  });

  app.get<{ Querystring: { page?: string; limit?: string; category?: string; unresolved_only?: string } }>(
    '/forex/notifications',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:view');
      if (!admin) return;
      const data = await listForexOperatorNotifications(request.query);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Params: { notificationId: string } }>(
    '/forex/notifications/:notificationId/acknowledge',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:view');
      if (!admin) return;
      try {
        await acknowledgeForexOperatorNotification(request.params.notificationId, admin.adminId);
        return reply.send({ success: true, data: { acknowledged: true } });
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      }
    },
  );

  app.post<{ Params: { notificationId: string } }>(
    '/forex/notifications/:notificationId/resolve',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
      if (!admin) return;
      try {
        await resolveForexOperatorNotification(request.params.notificationId, admin.adminId);
        return reply.send({ success: true, data: { resolved: true } });
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      }
    },
  );

  app.get<{ Params: { orderId: string } }>('/forex/dealing/orders/:orderId/actions', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:view');
    if (!admin) return;
    const actions = await listForexDealingActions(request.params.orderId);
    return reply.send({ success: true, data: { actions } });
  });

  app.post<{ Params: { orderId: string }; Body: { reason?: string } }>(
    '/forex/dealing/orders/:orderId/accept',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:manage');
      if (!admin) return;
      const reason = String(request.body?.reason ?? '').trim();
      if (reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason min 8 chars' } });
      }
      try {
        const result = await dealerAcceptForexOrder({
          orderId: request.params.orderId,
          reason,
          dealerAdminId: admin.adminId,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_dealer_accept',
          resourceType: 'forex_order',
          resourceId: result.order_id,
          oldValue: null,
          newValue: result,
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'ACCEPT_FAILED';
        const status = code === 'ORDER_NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Dealer accept failed' } });
      }
    },
  );

  app.post<{ Params: { orderId: string }; Body: { reason?: string } }>(
    '/forex/dealing/orders/:orderId/reject',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:manage');
      if (!admin) return;
      const reason = String(request.body?.reason ?? '').trim();
      if (reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason min 8 chars' } });
      }
      try {
        const result = await dealerRejectForexOrder({
          orderId: request.params.orderId,
          reason,
          dealerAdminId: admin.adminId,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_dealer_reject',
          resourceType: 'forex_order',
          resourceId: result.order_id,
          oldValue: { status: result.previous_status },
          newValue: { status: result.next_status, reason },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'REJECT_FAILED';
        const status = code === 'ORDER_NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Dealer reject failed' } });
      }
    },
  );

  app.get<{ Querystring: { page?: string; limit?: string; account_id?: string; status?: string } }>(
    '/forex/finance/requests',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:finance:view');
      if (!admin) return;
      const data = await listForexFinanceRequests(request.query);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: { account_id?: string; kind?: string; amount?: string; reason?: string } }>(
    '/forex/finance/requests',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:finance:manage');
      if (!admin) return;
      try {
        const result = await createForexFinanceRequest({
          accountId: String(request.body?.account_id ?? ''),
          kind: String(request.body?.kind ?? 'ADJUSTMENT').toUpperCase() as 'ADJUSTMENT',
          amount: String(request.body?.amount ?? ''),
          reason: String(request.body?.reason ?? ''),
          requestedBy: admin.adminId,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_finance_request_create',
          resourceType: 'forex_finance_request',
          resourceId: result.request_id,
          oldValue: null,
          newValue: result,
        });
        return reply.status(202).send({ success: true, data: { ...result, approval_required: true } });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'CREATE_FAILED';
        const status = code === 'ACCOUNT_NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Finance request failed' } });
      }
    },
  );

  app.get('/forex/desk-policy', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:view');
    if (!admin) return;
    return reply.send({
      success: true,
      data: {
        bookMode: getForexBookMode(),
        orderPolicy: getForexDeskOrderPolicy(),
        fills: 'MOCK',
        note: 'Book mode is stored for the LP gateway. Customer fills stay simulated until the broker is healthy.',
      },
    });
  });

  app.patch<{ Body: { reason?: string; bookMode?: string; orderPolicy?: Record<string, boolean> } }>(
    '/forex/desk-policy',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
      if (!admin) return;
      const reason = String(request.body?.reason ?? '').trim();
      if (reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason min 8 chars' } });
      }
      try {
        const previous = { bookMode: getForexBookMode(), orderPolicy: getForexDeskOrderPolicy() };
        if (request.body?.bookMode) setForexBookMode(request.body.bookMode);
        if (request.body?.orderPolicy) setForexDeskOrderPolicy(request.body.orderPolicy);
        const next = { bookMode: getForexBookMode(), orderPolicy: getForexDeskOrderPolicy() };
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_desk_policy_update',
          resourceType: 'forex_runtime',
          resourceId: 'desk-policy',
          oldValue: previous,
          newValue: { ...next, reason },
        });
        return reply.send({ success: true, data: { ...next, fills: 'MOCK' as const } });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'UPDATE_FAILED';
        return reply.status(400).send({ success: false, error: { code, message: 'Desk policy update failed' } });
      }
    },
  );

  app.post<{ Params: { positionId: string }; Body: { reason?: string; opposite_position_id?: string; volume?: string } }>(
    '/forex/positions/:positionId/close-by',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:manage');
      if (!admin) return;
      const reason = String(request.body?.reason ?? '').trim();
      const opposite = String(request.body?.opposite_position_id ?? '').trim();
      if (reason.length < 8 || !opposite) {
        return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason and the opposite position are required' } });
      }
      try {
        const result = await adminCloseByForexPositions(request.params.positionId, opposite, request.body?.volume);
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_manager_close_by',
          resourceType: 'forex_position',
          resourceId: request.params.positionId,
          oldValue: null,
          newValue: { reason, opposite, volume: request.body?.volume ?? 'matched' },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = deskErrorCode(e);
        const status = code === 'POSITION_NOT_FOUND' || code === 'POSITION_CLOSED' ? 404 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Close By failed' } });
      }
    },
  );

  app.post<{ Params: { positionId: string }; Body: { reason?: string; volume?: string } }>(
    '/forex/positions/:positionId/close',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:manage');
      if (!admin) return;
      const reason = String(request.body?.reason ?? '').trim();
      if (reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason min 8 chars' } });
      }
      try {
        const result = await adminCloseForexPosition(request.params.positionId, request.body?.volume);
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_manager_close',
          resourceType: 'forex_position',
          resourceId: request.params.positionId,
          oldValue: null,
          newValue: { reason, volume: request.body?.volume ?? 'full' },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = deskErrorCode(e);
        const status = code === 'POSITION_NOT_FOUND' || code === 'POSITION_CLOSED' ? 404 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Manager close failed' } });
      }
    },
  );

  app.post<{
    Body: {
      reason?: string;
      account_id?: string;
      symbol?: string;
      side?: string;
      order_type?: string;
      volume?: string;
      requested_price?: string;
      limit_price?: string;
    };
  }>('/forex/orders/place', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:manage');
    if (!admin) return;
    const reason = String(request.body?.reason ?? '').trim();
    const side = String(request.body?.side ?? '');
    const orderType = String(request.body?.order_type ?? '');
    if (reason.length < 8) {
      return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason min 8 chars' } });
    }
    if (side !== 'buy' && side !== 'sell') {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_SIDE', message: 'side must be buy or sell' } });
    }
    if (orderType !== 'market' && orderType !== 'limit' && orderType !== 'stop' && orderType !== 'stop_limit') {
      return reply.status(400).send({ success: false, error: { code: 'UNSUPPORTED_ORDER_TYPE', message: 'order_type is not supported' } });
    }
    try {
      const result = await adminPlaceForexOrder({
        accountId: String(request.body?.account_id ?? ''),
        symbol: String(request.body?.symbol ?? ''),
        side,
        orderType,
        volume: String(request.body?.volume ?? ''),
        requestedPrice: request.body?.requested_price,
        limitPrice: request.body?.limit_price,
      });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_manager_place',
        resourceType: 'forex_order',
        resourceId: result.orderId,
        oldValue: null,
        newValue: { ...result, reason },
      });
      return reply.send({ success: true, data: result });
    } catch (e) {
      const code = deskErrorCode(e);
      const status = code === 'ACCOUNT_NOT_FOUND' ? 404 : 400;
      return reply.status(status).send({ success: false, error: { code, message: 'Manager place failed' } });
    }
  });

  app.post<{ Params: { orderId: string }; Body: { reason?: string; requested_price?: string; limit_price?: string; volume?: string } }>(
    '/forex/orders/:orderId/modify',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:manage');
      if (!admin) return;
      const reason = String(request.body?.reason ?? '').trim();
      if (reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason min 8 chars' } });
      }
      try {
        const result = await adminModifyForexOrder(request.params.orderId, {
          ...(request.body?.requested_price != null ? { requestedPrice: String(request.body.requested_price) } : {}),
          ...(request.body?.limit_price != null ? { limitPrice: String(request.body.limit_price) } : {}),
          ...(request.body?.volume != null ? { volume: String(request.body.volume) } : {}),
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_manager_modify',
          resourceType: 'forex_order',
          resourceId: request.params.orderId,
          oldValue: null,
          newValue: { ...result, reason },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = deskErrorCode(e);
        const status = code === 'ORDER_NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Manager modify failed' } });
      }
    },
  );

  app.post<{ Params: { positionId: string }; Body: { reason?: string; type?: string; trigger_price?: string; trailing_distance?: string } }>(
    '/forex/positions/:positionId/protection',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:manage');
      if (!admin) return;
      const reason = String(request.body?.reason ?? '').trim();
      const type = String(request.body?.type ?? '');
      if (reason.length < 8) {
        return reply.status(400).send({ success: false, error: { code: 'REASON_REQUIRED', message: 'Reason min 8 chars' } });
      }
      if (type !== 'STOP_LOSS' && type !== 'TAKE_PROFIT') {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_PROTECTION_TYPE', message: 'type must be STOP_LOSS or TAKE_PROFIT' } });
      }
      try {
        const result = await adminSetForexProtection({
          positionId: request.params.positionId,
          type,
          triggerPrice: String(request.body?.trigger_price ?? ''),
          trailingDistance: request.body?.trailing_distance,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_manager_protection',
          resourceType: 'forex_position',
          resourceId: request.params.positionId,
          oldValue: null,
          newValue: { ...result, reason },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = deskErrorCode(e);
        return reply.status(400).send({ success: false, error: { code, message: 'Protection update failed' } });
      }
    },
  );

  app.get<{ Params: { accountId: string } }>('/forex/accounts/:accountId/statement', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:finance:view');
    if (!admin) return;
    try {
      const data = await forexAccountStatement(request.params.accountId);
      return reply.send({ success: true, data });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'STATEMENT_FAILED';
      return reply.status(400).send({ success: false, error: { code, message: 'Statement failed' } });
    }
  });

  app.get('/forex/automation/workflows', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:view');
    if (!admin) return;
    const workflows = await listForexAutomationWorkflows();
    return reply.send({ success: true, data: { workflows } });
  });

  app.post<{ Body: { code?: string; name?: string; trigger_type?: string; conditions?: unknown[]; actions?: unknown[] } }>(
    '/forex/automation/workflows',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
      if (!admin) return;
      try {
        const wf = await createForexAutomationWorkflow({
          code: String(request.body?.code ?? ''),
          name: String(request.body?.name ?? ''),
          triggerType: String(request.body?.trigger_type ?? 'manual'),
          conditions: request.body?.conditions,
          actions: request.body?.actions,
          createdBy: admin.adminId,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_automation_workflow_create',
          resourceType: 'forex_automation_workflow',
          resourceId: wf.workflow_id,
          oldValue: null,
          newValue: wf,
        });
        return reply.send({ success: true, data: wf });
      } catch (e) {
        return reply.status(400).send({
          success: false,
          error: { code: e instanceof Error ? e.message : 'CREATE_FAILED', message: 'Workflow create failed' },
        });
      }
    },
  );

  app.post<{ Params: { workflowId: string }; Body: Record<string, unknown> }>(
    '/forex/automation/workflows/:workflowId/dry-run',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
      if (!admin) return;
      try {
        const data = await runForexAutomationWorkflowDryRun(request.params.workflowId, request.body ?? {});
        return reply.send({ success: true, data });
      } catch (e) {
        return reply.status(404).send({
          success: false,
          error: { code: e instanceof Error ? e.message : 'RUN_FAILED', message: 'Dry-run failed' },
        });
      }
    },
  );

  app.get<{ Params: { workflowId: string } }>(
    '/forex/automation/workflows/:workflowId/runs',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:view');
      if (!admin) return;
      const runs = await listForexAutomationRuns(request.params.workflowId);
      return reply.send({ success: true, data: { runs } });
    },
  );

  app.patch<{ Params: { workflowId: string }; Body: { enabled?: boolean } }>(
    '/forex/automation/workflows/:workflowId/enabled',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
      if (!admin) return;
      try {
        const data = await setForexAutomationWorkflowEnabled(request.params.workflowId, Boolean(request.body?.enabled));
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_automation_workflow_enabled',
          resourceType: 'forex_automation_workflow',
          resourceId: request.params.workflowId,
          oldValue: null,
          newValue: data,
        });
        return reply.send({ success: true, data });
      } catch (e) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Workflow not found' } });
      }
    },
  );

  app.post<{ Body: { code?: string; label?: string; user_id?: string | null; commission_per_lot?: string | null } }>(
    '/forex/partners',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
      if (!admin) return;
      try {
        const row = await createForexPartnerProfile({
          code: String(request.body?.code ?? ''),
          label: String(request.body?.label ?? ''),
          userId: request.body?.user_id,
          commissionPerLot: request.body?.commission_per_lot,
        });
        return reply.status(201).send({ success: true, data: row });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'CREATE_FAILED';
        const status = /duplicate|unique/i.test(code) ? 409 : 400;
        return reply.status(status).send({ success: false, error: { code: status === 409 ? 'CODE_TAKEN' : code, message: 'Partner profile was not created' } });
      }
    },
  );

  app.post<{ Params: { partnerId: string } }>('/forex/partners/:partnerId/accrue-volume', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    try {
      const data = await accrueForexPartnerVolume(request.params.partnerId, admin.adminId);
      return reply.send({ success: true, data });
    } catch (e) {
      return reply.status(400).send({ success: false, error: { code: e instanceof Error ? e.message : 'ACCRUE_FAILED', message: 'Volume accrual failed' } });
    }
  });

  app.get('/forex/signals/providers', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:view');
    if (!admin) return;
    const rows = await listForexSignalProviders();
    return reply.send({ success: true, data: { rows, copying: false } });
  });

  app.post<{ Body: { name?: string } }>('/forex/signals/providers', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    try {
      const row = await createForexSignalProvider(String(request.body?.name ?? ''));
      return reply.status(201).send({ success: true, data: { ...row, copying: false } });
    } catch (e) {
      return reply.status(400).send({ success: false, error: { code: e instanceof Error ? e.message : 'CREATE_FAILED', message: 'Signal provider was not created' } });
    }
  });

  app.patch<{ Params: { providerId: string }; Body: { status?: string } }>(
    '/forex/signals/providers/:providerId',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
      if (!admin) return;
      const status = request.body?.status === 'active' ? 'active' : request.body?.status === 'paused' ? 'paused' : null;
      if (!status) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_STATUS', message: 'Status must be paused or active' } });
      }
      try {
        const row = await setForexSignalProviderStatus(request.params.providerId, status);
        return reply.send({ success: true, data: { ...row, copying: false } });
      } catch (e) {
        return reply.status(404).send({ success: false, error: { code: e instanceof Error ? e.message : 'NOT_FOUND', message: 'Signal provider not found' } });
      }
    },
  );

  app.post<{ Params: { partnerId: string }; Body: { volume_lots?: string; commission_amount?: string; account_id?: string; reason?: string } }>(
    '/forex/partners/:partnerId/accruals',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
      if (!admin) return;
      try {
        const result = await accrueForexPartnerCommission({
          partnerId: request.params.partnerId,
          accountId: request.body?.account_id,
          volumeLots: String(request.body?.volume_lots ?? '0'),
          commissionAmount: String(request.body?.commission_amount ?? ''),
          adminId: admin.adminId,
          reason: String(request.body?.reason ?? ''),
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        return reply.status(400).send({ success: false, error: { code: e instanceof Error ? e.message : 'ACCRUE_FAILED', message: 'Accrual failed' } });
      }
    },
  );

  app.get<{ Params: { partnerId: string } }>('/forex/partners/:partnerId/accruals', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:view');
    if (!admin) return;
    const rows = await listForexPartnerAccruals(request.params.partnerId);
    return reply.send({ success: true, data: { rows } });
  });

  app.post<{ Params: { partnerId: string }; Body: { amount?: string; reason?: string } }>(
    '/forex/partners/:partnerId/payout-requests',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
      if (!admin) return;
      try {
        const result = await createForexPartnerPayoutRequest({
          partnerId: request.params.partnerId,
          amount: String(request.body?.amount ?? ''),
          reason: String(request.body?.reason ?? ''),
          requestedBy: admin.adminId,
        });
        return reply.status(202).send({ success: true, data: result });
      } catch (e) {
        return reply.status(400).send({ success: false, error: { code: e instanceof Error ? e.message : 'PAYOUT_FAILED', message: 'Payout request failed' } });
      }
    },
  );

  app.get('/forex/partners/payout-requests', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:view');
    if (!admin) return;
    const rows = await listForexPartnerPayoutRequests();
    const externalRail = process.env.FOREX_PARTNER_PAYOUT_URL?.trim() ? 'CONFIGURED' : 'NOT_CONFIGURED';
    return reply.send({ success: true, data: { rows, external_rail: externalRail } });
  });

  app.get<{ Querystring: { page?: string; limit?: string; status?: string; subject_id?: string } }>(
    '/forex/compliance/cases',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:compliance:view');
      if (!admin) return;
      const data = await listForexComplianceCases(request.query);
      return reply.send({
        success: true,
        data: { ...data, provider_status: 'NOT_CONNECTED', note: 'External screening not configured — manual cases only.' },
      });
    },
  );

  app.post<{ Body: { subject_type?: string; subject_id?: string; case_type?: string; summary?: string } }>(
    '/forex/compliance/cases',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:compliance:manage');
      if (!admin) return;
      try {
        const st = String(request.body?.subject_type ?? 'ACCOUNT').toUpperCase() as 'ACCOUNT';
        const result = await createForexComplianceCase({
          subjectType: st,
          subjectId: String(request.body?.subject_id ?? ''),
          caseType: String(request.body?.case_type ?? 'REVIEW'),
          summary: String(request.body?.summary ?? ''),
          openedBy: admin.adminId,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_compliance_case_open',
          resourceType: 'forex_compliance_case',
          resourceId: result.case_id,
          oldValue: null,
          newValue: result,
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        return reply.status(400).send({
          success: false,
          error: { code: e instanceof Error ? e.message : 'CREATE_FAILED', message: 'Case create failed' },
        });
      }
    },
  );

  app.patch<{ Params: { caseId: string }; Body: { assignee_admin_id?: string } }>(
    '/forex/compliance/cases/:caseId/assign',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:compliance:manage');
      if (!admin) return;
      const assignee = String(request.body?.assignee_admin_id ?? '').trim();
      if (!assignee) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_BODY', message: 'assignee_admin_id required' } });
      }
      try {
        await assignForexComplianceCase(request.params.caseId, assignee);
        return reply.send({ success: true, data: { assigned: true } });
      } catch {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } });
      }
    },
  );

  app.patch<{ Params: { caseId: string }; Body: { status?: string; note?: string } }>(
    '/forex/compliance/cases/:caseId/status',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:compliance:manage');
      if (!admin) return;
      try {
        const result = await transitionForexComplianceCaseStatus({
          caseId: request.params.caseId,
          nextStatus: String(request.body?.status ?? ''),
          note: String(request.body?.note ?? ''),
          adminId: admin.adminId,
        });
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_compliance_case_status',
          resourceType: 'forex_compliance_case',
          resourceId: request.params.caseId,
          oldValue: { status: result.previous_status },
          newValue: { status: result.next_status },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'STATUS_FAILED';
        const status = code === 'CASE_NOT_FOUND' ? 404 : code === 'TRANSITION_FORBIDDEN' ? 409 : 400;
        return reply.status(status).send({ success: false, error: { code, message: 'Status transition failed' } });
      }
    },
  );

  app.post<{ Params: { caseId: string }; Body: { decision?: string } }>(
    '/forex/compliance/cases/:caseId/close',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:compliance:manage');
      if (!admin) return;
      try {
        await closeForexComplianceCase(request.params.caseId, String(request.body?.decision ?? ''), admin.adminId);
        return reply.send({ success: true, data: { closed: true } });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'CLOSE_FAILED';
        return reply.status(code === 'CASE_NOT_FOUND' ? 404 : 400).send({
          success: false,
          error: { code, message: 'Close failed' },
        });
      }
    },
  );

  app.post<{ Body: { accountId?: string } }>('/forex/broker/reconciliation', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:view');
    if (!admin) return;
    const accountId = String(request.body?.accountId ?? '').trim();
    if (!accountId) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_REQUEST', message: 'accountId is required' } });
    }
    const report = await buildForexBrokerReconciliation(accountId);
    return reply.send({ success: true, data: report });
  });

  app.post<{ Body: { reportId?: string; confirm?: boolean } }>('/forex/broker/reconciliation/apply', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    const reportId = String(request.body?.reportId ?? '').trim();
    const applied = await applyForexBrokerReconciliation(reportId, request.body?.confirm === true);
    if (!applied.ok) {
      return reply.status(409).send({ success: false, error: { code: applied.code, message: applied.message } });
    }
    return reply.send({ success: true, data: applied });
  });
}
