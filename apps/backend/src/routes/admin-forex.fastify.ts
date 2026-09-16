/**
 * Admin Forex FDM — ops (F1–F3). Mounted at /api/v1/admin.
 * F3 control mutations require control:trading + audit log.
 */
import type { FastifyInstance } from 'fastify';
import { getAdminFromRequest, getAdminWithPermission } from './admin.fastify.js';
import {
  applyForexAdminControlsPatch,
  applyForexInstrumentStatusPatch,
  buildForexAdminControlsSnapshot,
} from '../services/forex/admin/controls.js';
import {
  applyForexAdminPolicyPatch,
  applyForexInstrumentPolicyPatch,
  buildForexAdminPolicySnapshot,
} from '../services/forex/admin/policy.js';
import { effectiveForexRuntimeFlags } from '../services/forex/admin/runtime-controls.js';
import { logAuditFromRequest } from '../services/audit-log.service.js';
import { getForexAdminBackendConfig } from '../services/forex/admin/config.js';
import {
  listForexAdminExecutions,
  listForexAdminOrders,
  listForexAdminPositions,
  parseForexAdminListQuery,
} from '../services/forex/admin/lists.js';
import { loadForexAdminOverviewCounts } from '../services/forex/admin/overview.js';
import { forexConfig } from '../services/forex/config.js';
import { forexReadinessSnapshot } from '../services/forex/durability/ready.js';
import { forexMarketDataWorkerSnapshot } from '../services/forex/market-data/worker.js';
import { listForexSymbols } from '../services/forex/instruments.catalog.js';
import {
  applyForexAdminRoutingPatch,
  applyForexRealForexArmPatch,
  buildForexAdminExecutionSnapshot,
} from '../services/forex/admin/execution.js';
import {
  listForexAdminConfigAudit,
  listForexAdminJournalEvents,
  loadForexAdminUserForexSnapshot,
  parseForexAdminAuditQuery,
  parseForexAdminJournalQuery,
} from '../services/forex/admin/journal-audit.js';
import { buildForexAdminLedgerSnapshot } from '../services/forex/admin/ledger-recon.js';
import {
  exportForexAdminExecutionsCsv,
  exportForexAdminJournalCsv,
  exportForexAdminOrdersCsv,
} from '../services/forex/admin/exports.js';
import { adminForceCancelForexOrder } from '../services/forex/admin/ops-actions.js';

type ForexAdminPolicyPatchBody = {
  leverage?: { global_max?: string; default_account?: string };
  margin?: { warning_level?: string; call_level?: string; stop_out_level?: string; maintenance_ratio?: string };
  commission?: { model?: string; rate?: string; minimum?: string };
  swap?: { long_swap?: string; short_swap?: string; rollover_time?: string; timezone?: string; triple_swap_day?: number };
};

type ForexAdminListQuerystring = {
  page?: string;
  limit?: string;
  symbol?: string;
  status?: string;
  account_id?: string;
  side?: string;
};

export default async function adminForexRoutes(app: FastifyInstance): Promise<void> {
  app.get('/forex/config', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;

    return reply.send({
      success: true,
      data: {
        config: getForexAdminBackendConfig(),
        readiness: forexReadinessSnapshot(),
        runtime: {
          realForex: false,
          positionMode: forexConfig.positionMode,
          marketData: forexMarketDataWorkerSnapshot(),
          symbolCount: listForexSymbols().length,
        },
      },
    });
  });

  app.get('/forex/overview', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;

    const counts = await loadForexAdminOverviewCounts();
    const readiness = forexReadinessSnapshot();

    return reply.send({
      success: true,
      data: {
        counts,
        readiness,
        posture: {
          source: 'SIMULATED',
          executionMode: 'MOCK',
          realForex: false,
          killSwitch: effectiveForexRuntimeFlags().killSwitch,
          demoFundingEnabled: effectiveForexRuntimeFlags().demoFundingEnabled,
        },
      },
    });
  });

  app.get('/forex/system', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;

    return reply.send({
      success: true,
      data: {
        readiness: forexReadinessSnapshot(),
        marketData: forexMarketDataWorkerSnapshot(),
        flags: {
          marketDataEnabled: forexConfig.marketDataEnabled,
          persistQuoteTicks: forexConfig.persistQuoteTicks,
          killSwitch: effectiveForexRuntimeFlags().killSwitch,
          fundingTestApiEnabled: effectiveForexRuntimeFlags().fundingTestApiEnabled,
          demoFundingEnabled: effectiveForexRuntimeFlags().demoFundingEnabled,
          executionTestApiEnabled: effectiveForexRuntimeFlags().executionTestApiEnabled,
        },
      },
    });
  });

  app.get<{ Querystring: ForexAdminListQuerystring }>('/forex/orders', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;

    const q = parseForexAdminListQuery(request.query);
    const data = await listForexAdminOrders(q);
    return reply.send({ success: true, data });
  });

  app.get<{ Querystring: ForexAdminListQuerystring }>('/forex/executions', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;

    const q = parseForexAdminListQuery(request.query);
    const data = await listForexAdminExecutions(q);
    return reply.send({ success: true, data });
  });

  app.get<{ Querystring: ForexAdminListQuerystring }>('/forex/positions', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;

    const q = parseForexAdminListQuery(request.query);
    const data = await listForexAdminPositions(q);
    return reply.send({ success: true, data });
  });

  app.get('/forex/controls', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    return reply.send({ success: true, data: buildForexAdminControlsSnapshot() });
  });

  app.patch<{
    Body: {
      reason?: string;
      kill_switch?: boolean;
      demo_funding?: boolean;
      funding_test_api?: boolean;
      execution_test_api?: boolean;
    };
  }>('/forex/controls', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'control:trading');
    if (!admin) return;

    const reason = (request.body?.reason ?? '').trim();
    const patch = {
      kill_switch: request.body?.kill_switch,
      demo_funding: request.body?.demo_funding,
      funding_test_api: request.body?.funding_test_api,
      execution_test_api: request.body?.execution_test_api,
    };
    const hasChange = Object.values(patch).some((v) => typeof v === 'boolean');
    if (!hasChange) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_CHANGES', message: 'Provide at least one boolean control to update.' },
      });
    }
    const touchesKill =
      typeof patch.kill_switch === 'boolean' ||
      (typeof patch.demo_funding === 'boolean' && patch.demo_funding);
    if (touchesKill && reason.length < 8) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason (min 8 characters) required for this change.' },
      });
    }

    const changes = applyForexAdminControlsPatch(patch);
    for (const ch of changes) {
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_admin_control_update',
        resourceType: 'forex_runtime',
        resourceId: ch.key,
        oldValue: { value: ch.previous, reason: reason || null },
        newValue: { value: ch.next, reason: reason || null },
      });
    }

    return reply.send({ success: true, data: { changes, snapshot: buildForexAdminControlsSnapshot() } });
  });

  app.patch<{
    Params: { symbol: string };
    Body: { trading_status?: string; reason?: string };
  }>('/forex/instruments/:symbol/trading-status', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'control:trading');
    if (!admin) return;

    const reason = (request.body?.reason ?? '').trim();
    const tradingStatus = (request.body?.trading_status ?? '').trim();
    if (!tradingStatus) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_BODY', message: 'trading_status is required (active, halted, closed).' },
      });
    }
    if (reason.length < 8) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason (min 8 characters) is required.' },
      });
    }

    try {
      const result = applyForexInstrumentStatusPatch(request.params.symbol, tradingStatus);
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_instrument_trading_status',
        resourceType: 'forex_instrument',
        resourceId: result.symbol,
        oldValue: { tradingStatus: result.previous, reason },
        newValue: { tradingStatus: result.next, reason },
      });
      return reply.send({ success: true, data: { ...result, snapshot: buildForexAdminControlsSnapshot() } });
    } catch {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_TRADING_STATUS', message: 'trading_status must be active, halted, or closed.' },
      });
    }
  });

  app.get('/forex/policy', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    return reply.send({ success: true, data: buildForexAdminPolicySnapshot() });
  });

  app.patch<{ Body: Record<string, unknown> }>('/forex/policy', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'settings:edit');
    if (!admin) return;

    const reason = String(request.body?.reason ?? '').trim();
    if (reason.length < 8) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason (min 8 characters) is required.' },
      });
    }

    try {
      const changes = applyForexAdminPolicyPatch({
        reason,
        leverage: request.body?.leverage as ForexAdminPolicyPatchBody['leverage'],
        margin: request.body?.margin as ForexAdminPolicyPatchBody['margin'],
        commission: request.body?.commission as ForexAdminPolicyPatchBody['commission'],
        swap: request.body?.swap as ForexAdminPolicyPatchBody['swap'],
      });
      if (!changes.length) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_CHANGES', message: 'No policy fields to update.' },
        });
      }
      for (const ch of changes) {
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_admin_policy_update',
          resourceType: 'forex_policy',
          resourceId: ch.field,
          oldValue: { value: ch.previous as string | Record<string, unknown> | null },
          newValue: { value: ch.next as string | Record<string, unknown> | null, reason },
        });
      }
      return reply.send({ success: true, data: { changes, snapshot: buildForexAdminPolicySnapshot() } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'POLICY_UPDATE_FAILED';
      return reply.status(400).send({
        success: false,
        error: { code: msg, message: 'Policy update rejected.' },
      });
    }
  });

  app.patch<{
    Params: { symbol: string };
    Body: { reason?: string; max_leverage?: string; min_volume?: string; max_volume?: string };
  }>('/forex/policy/instruments/:symbol', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'settings:edit');
    if (!admin) return;

    const reason = (request.body?.reason ?? '').trim();
    if (reason.length < 8) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason (min 8 characters) is required.' },
      });
    }

    try {
      const result = applyForexInstrumentPolicyPatch(request.params.symbol, {
        max_leverage: request.body?.max_leverage,
        min_volume: request.body?.min_volume,
        max_volume: request.body?.max_volume,
      });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_instrument_policy_update',
        resourceType: 'forex_instrument',
        resourceId: result.symbol,
        oldValue: { ...result.previous, reason },
        newValue: { ...result.next, reason },
      });
      return reply.send({ success: true, data: { ...result, snapshot: buildForexAdminPolicySnapshot() } });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'UPDATE_FAILED';
      return reply.status(400).send({
        success: false,
        error: { code, message: 'Instrument policy update failed.' },
      });
    }
  });

  app.get('/forex/execution', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const data = await buildForexAdminExecutionSnapshot();
    return reply.send({ success: true, data });
  });

  app.patch<{
    Params: { providerId: string };
    Body: { reason?: string; enabled?: boolean; priority?: number; failover_enabled?: boolean };
  }>('/forex/execution/routing/:providerId', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'control:trading');
    if (!admin) return;

    const reason = (request.body?.reason ?? '').trim();
    const patch = {
      enabled: request.body?.enabled,
      priority: request.body?.priority,
      failover_enabled: request.body?.failover_enabled,
    };
    const hasChange = Object.values(patch).some((v) => v !== undefined);
    if (!hasChange) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_CHANGES', message: 'Provide enabled, priority, or failover_enabled.' },
      });
    }
    if (reason.length < 8) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason (min 8 characters) is required.' },
      });
    }

    try {
      const result = applyForexAdminRoutingPatch(request.params.providerId, patch);
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_lp_routing_update',
        resourceType: 'forex_routing',
        resourceId: result.providerId,
        oldValue: { ...result.previous, reason },
        newValue: { ...result.next, reason },
      });
      const snapshot = await buildForexAdminExecutionSnapshot();
      return reply.send({ success: true, data: { ...result, snapshot } });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'ROUTING_UPDATE_FAILED';
      const status = code === 'LIVE_LP_FORBIDDEN' ? 403 : 400;
      return reply.status(status).send({
        success: false,
        error: { code, message: 'Routing update rejected.' },
      });
    }
  });

  app.get<{ Querystring: { page?: string; limit?: string; account_id?: string } }>('/forex/journal', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const q = parseForexAdminJournalQuery(request.query);
    const data = await listForexAdminJournalEvents(q);
    return reply.send({ success: true, data });
  });

  app.get<{ Querystring: { page?: string; limit?: string; action?: string } }>('/forex/audit', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'audit:view');
    if (!admin) return;
    const q = parseForexAdminAuditQuery(request.query);
    const data = await listForexAdminConfigAudit(q);
    return reply.send({ success: true, data });
  });

  app.get<{ Params: { userId: string } }>('/forex/users/:userId/summary', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const data = await loadForexAdminUserForexSnapshot(request.params.userId);
    return reply.send({ success: true, data });
  });

  app.patch<{ Body: { requested?: boolean; reason?: string } }>('/forex/execution/real-forex', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'control:trading');
    if (!admin) return;

    const reason = (request.body?.reason ?? '').trim();
    if (typeof request.body?.requested !== 'boolean') {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_BODY', message: 'requested (boolean) is required.' },
      });
    }
    if (reason.length < 8) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason (min 8 characters) is required.' },
      });
    }

    try {
      const result = applyForexRealForexArmPatch(request.body.requested);
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_real_forex_arm',
        resourceType: 'forex_runtime',
        resourceId: 'real_forex_arm',
        oldValue: { armRequested: result.previous, effectiveRealForex: false, reason },
        newValue: { armRequested: result.next, effectiveRealForex: false, reason },
      });
      const snapshot = await buildForexAdminExecutionSnapshot();
      return reply.send({ success: true, data: { ...result, snapshot } });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'ARM_FAILED';
      return reply.status(400).send({
        success: false,
        error: { code, message: 'REAL_FOREX arm request rejected.' },
      });
    }
  });

  app.get('/forex/ledger', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const data = await buildForexAdminLedgerSnapshot();
    return reply.send({ success: true, data });
  });

  app.get<{ Querystring: ForexAdminListQuerystring }>('/forex/orders/export', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const csv = await exportForexAdminOrdersCsv(request.query);
    return reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="forex-orders.csv"').send(csv);
  });

  app.get<{ Querystring: ForexAdminListQuerystring }>('/forex/executions/export', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const csv = await exportForexAdminExecutionsCsv(request.query);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="forex-executions.csv"')
      .send(csv);
  });

  app.get<{ Querystring: { account_id?: string } }>('/forex/journal/export', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const csv = await exportForexAdminJournalCsv(request.query);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="forex-journal.csv"')
      .send(csv);
  });

  app.post<{ Params: { orderId: string }; Body: { reason?: string } }>(
    '/forex/orders/:orderId/force-cancel',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'control:trading');
      if (!admin) return;

      const reason = (request.body?.reason ?? '').trim();
      if (reason.length < 8) {
        return reply.status(400).send({
          success: false,
          error: { code: 'REASON_REQUIRED', message: 'Reason (min 8 characters) is required.' },
        });
      }

      try {
        const result = await adminForceCancelForexOrder(request.params.orderId);
        await logAuditFromRequest(request, {
          actorType: 'admin',
          actorId: admin.adminId,
          action: 'forex_admin_force_cancel',
          resourceType: 'forex_order',
          resourceId: result.order_id,
          oldValue: { status: result.previous_status, reason },
          newValue: { status: result.next_status, reason },
        });
        return reply.send({ success: true, data: result });
      } catch (e) {
        const code = e instanceof Error ? e.message : 'CANCEL_FAILED';
        const status = code === 'ORDER_NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({
          success: false,
          error: { code, message: 'Force cancel failed.' },
        });
      }
    },
  );
}
