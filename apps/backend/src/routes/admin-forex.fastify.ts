/**
 * Admin Forex FDM — ops (F1–F3). Mounted at /api/v1/admin.
 * F3 control mutations require forex:controls:manage (+ audit log).
 */
import type { FastifyInstance } from 'fastify';
import { getAdminFromRequest, getAdminWithPermission } from './admin.fastify.js';
import {
  applyForexAdminControlsPatch,
  applyForexInstrumentStatusPatch,
  buildForexAdminControlsSnapshotWithKyc,
} from '../services/forex/admin/controls.js';
import { getForexKycPolicy, setForexKycRequired } from '../services/forex/customer/forex-kyc-policy.service.js';
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
import { buildForexCommandAttentionSnapshot } from '../services/forex/admin/command-attention.js';
import { buildForexAdminMarketDataQuotesSnapshot } from '../services/forex/admin/market-data-quotes.js';
import { listForexAdminTradingAccounts } from '../services/forex/admin/trading-accounts.js';
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
  exportForexAdminCrmClientsCsv,
  exportForexAdminExecutionsCsv,
  exportForexAdminFinanceAccountsCsv,
  exportForexAdminFinanceReconciliationCsv,
  exportForexAdminJournalCsv,
  exportForexAdminOrdersCsv,
} from '../services/forex/admin/exports.js';
import { adminForceCancelForexOrder } from '../services/forex/admin/ops-actions.js';
import { buildForexAdminIntegrationsSnapshot } from '../services/forex/admin/integrations.js';
import { buildForexAdminCrmClientActivityScoped } from '../services/forex/admin/crm-client-activity.js';
import {
  buildForexAdminCrmClientDetailScoped,
  buildForexAdminCrmClientsSnapshotForAdmin,
} from '../services/forex/admin/crm-clients.js';
import { listForexDealingQueue } from '../services/forex/admin/dealing-queue.js';
import { buildForexCrmSalesPipelineSnapshot } from '../services/forex/admin/crm-sales-pipeline.js';
import { buildForexAdminReportingSnapshot } from '../services/forex/admin/forex-admin-reporting.js';
import { buildForexAdminRiskControlSnapshot } from '../services/forex/admin/forex-risk-control.js';
import { listForexPartnerProfiles } from '../services/forex/admin/forex-partners.js';
import {
  deleteForexHolidayDate,
  listForexHolidayDates,
  upsertForexHolidayDate,
} from '../services/forex/admin/holiday-calendar-admin.js';
import {
  buildForexAdminFinanceAccountDetail,
  buildForexAdminFinanceAccountsSnapshot,
  listForexAdminFinanceReconciliation,
} from '../services/forex/admin/crm-finance.js';
import { buildForexAdminRoutingDeskSnapshot } from '../services/forex/admin/routing-desk.js';
import { createForexAdminApprovalRequest } from '../services/forex/admin/forex-admin-approval-entry.js';

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
          featureFlags: {
            routingV2Enabled: forexConfig.routingV2Enabled,
            adapterLayerHookEnabled: forexConfig.adapterLayerHookEnabled,
          },
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

  app.get('/forex/command/attention', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const data = await buildForexCommandAttentionSnapshot();
    return reply.send({ success: true, data });
  });

  app.get<{ Querystring: { symbol?: string; stale_only?: string } }>(
    '/forex/market-data/quotes',
    async (request, reply) => {
      const admin = await getAdminFromRequest(app, request, reply, false);
      if (!admin) return;
      const data = await buildForexAdminMarketDataQuotesSnapshot({
        symbol: request.query.symbol,
        stale_only: request.query.stale_only === '1' || request.query.stale_only === 'true',
      });
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Querystring: { page?: string; limit?: string; q?: string; status?: string } }>(
    '/forex/accounts/list',
    async (request, reply) => {
      const admin = await getAdminFromRequest(app, request, reply, false);
      if (!admin) return;
      const data = await listForexAdminTradingAccounts(request.query);
      return reply.send({ success: true, data });
    },
  );

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
    return reply.send({ success: true, data: await buildForexAdminControlsSnapshotWithKyc() });
  });

  app.patch<{
    Body: {
      reason?: string;
      kill_switch?: boolean;
      demo_funding?: boolean;
      funding_test_api?: boolean;
      execution_test_api?: boolean;
      kyc_required?: boolean;
    };
  }>('/forex/controls', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;

    const reason = (request.body?.reason ?? '').trim();
    const patch = {
      kill_switch: request.body?.kill_switch,
      demo_funding: request.body?.demo_funding,
      funding_test_api: request.body?.funding_test_api,
      execution_test_api: request.body?.execution_test_api,
    };
    const kycRequired = request.body?.kyc_required;
    const hasKycChange = typeof kycRequired === 'boolean';
    const hasChange = Object.values(patch).some((v) => typeof v === 'boolean') || hasKycChange;
    if (!hasChange) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_CHANGES', message: 'Provide at least one boolean control to update.' },
      });
    }
    const touchesKill =
      typeof patch.kill_switch === 'boolean' ||
      (typeof patch.demo_funding === 'boolean' && patch.demo_funding);
    if ((touchesKill || hasKycChange) && reason.length < 8) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason (min 8 characters) required for this change.' },
      });
    }

    let kycPolicyChange: { key: 'kycRequired'; previous: boolean; next: boolean } | null = null;
    if (typeof kycRequired === 'boolean') {
      const previous = await getForexKycPolicy();
      const next = await setForexKycRequired(kycRequired);
      kycPolicyChange = { key: 'kycRequired', previous: previous.required, next: next.required };
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_admin_control_update',
        resourceType: 'forex_kyc_policy',
        resourceId: 'forex_kyc_required',
        oldValue: { value: previous.required, reason },
        newValue: { value: next.required, reason },
      });
    }

    const immediate = {
      funding_test_api: patch.funding_test_api,
      execution_test_api: patch.execution_test_api,
    };
    const immediateChanges =
      typeof immediate.funding_test_api === 'boolean' || typeof immediate.execution_test_api === 'boolean'
        ? applyForexAdminControlsPatch(immediate)
        : [];

    const needsApproval =
      typeof patch.kill_switch === 'boolean' || typeof patch.demo_funding === 'boolean';

    if (needsApproval) {
      const approvalPatch = {
        kill_switch: patch.kill_switch,
        demo_funding: patch.demo_funding,
      };
      for (const ch of immediateChanges) {
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
      const { request: approvalReq, correlationId } = await createForexAdminApprovalRequest({
        actionType: 'forex_controls_patch',
        requestedBy: admin.adminId,
        payload: {
          controls: approvalPatch,
          reason,
          executingAdminId: admin.adminId,
        },
      });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'admin_approval_request_create',
        resourceType: 'admin_approval_request',
        resourceId: approvalReq.id,
        oldValue: null,
        newValue: { action_type: 'forex_controls_patch', correlationId, controls: approvalPatch },
      });
      return reply.status(202).send({
        success: true,
        data: {
          approval_required: true,
          approval_id: approvalReq.id,
          immediate_changes: immediateChanges,
          kycPolicy: kycPolicyChange,
          snapshot: await buildForexAdminControlsSnapshotWithKyc(),
        },
      });
    }

    if (!immediateChanges.length && !kycPolicyChange) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NO_CHANGES', message: 'Provide at least one boolean control to update.' },
      });
    }

    for (const ch of immediateChanges) {
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

    return reply.send({
      success: true,
      data: {
        changes: immediateChanges,
        kycPolicy: kycPolicyChange,
        snapshot: await buildForexAdminControlsSnapshotWithKyc(),
      },
    });
  });

  app.patch<{
    Params: { symbol: string };
    Body: { trading_status?: string; reason?: string };
  }>('/forex/instruments/:symbol/trading-status', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
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
      if (tradingStatus === 'halted' || tradingStatus === 'closed') {
        const { request: approvalReq, correlationId } = await createForexAdminApprovalRequest({
          actionType: 'forex_controls_patch',
          requestedBy: admin.adminId,
          payload: {
            instrument: { symbol: request.params.symbol, trading_status: tradingStatus },
            reason,
            executingAdminId: admin.adminId,
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
            action_type: 'forex_controls_patch',
            symbol: request.params.symbol,
            trading_status: tradingStatus,
            correlationId,
          },
        });
        return reply.status(202).send({
          success: true,
          data: {
            approval_required: true,
            approval_id: approvalReq.id,
            snapshot: await buildForexAdminControlsSnapshotWithKyc(),
          },
        });
      }
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
      return reply.send({ success: true, data: { ...result, snapshot: await buildForexAdminControlsSnapshotWithKyc() } });
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
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;

    const reason = String(request.body?.reason ?? '').trim();
    if (reason.length < 8) {
      return reply.status(400).send({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Reason (min 8 characters) is required.' },
      });
    }

    try {
      const patch = {
        reason,
        leverage: request.body?.leverage as ForexAdminPolicyPatchBody['leverage'],
        margin: request.body?.margin as ForexAdminPolicyPatchBody['margin'],
        commission: request.body?.commission as ForexAdminPolicyPatchBody['commission'],
        swap: request.body?.swap as ForexAdminPolicyPatchBody['swap'],
      };
      const hasFields =
        patch.leverage != null || patch.margin != null || patch.commission != null || patch.swap != null;
      if (!hasFields) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_CHANGES', message: 'No policy fields to update.' },
        });
      }
      const { request: approvalReq, correlationId } = await createForexAdminApprovalRequest({
        actionType: 'forex_policy_patch',
        requestedBy: admin.adminId,
        payload: { patch, executingAdminId: admin.adminId },
      });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'admin_approval_request_create',
        resourceType: 'admin_approval_request',
        resourceId: approvalReq.id,
        oldValue: null,
        newValue: { action_type: 'forex_policy_patch', correlationId },
      });
      return reply.status(202).send({
        success: true,
        data: {
          approval_required: true,
          approval_id: approvalReq.id,
          snapshot: buildForexAdminPolicySnapshot(),
        },
      });
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
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
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

  app.get('/forex/integrations', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const data = await buildForexAdminIntegrationsSnapshot();
    return reply.send({ success: true, data });
  });

  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      q?: string;
      account_status?: string;
      user_status?: string;
      has_open_positions?: string;
      kyc_status?: string;
      risk_level?: string;
    };
  }>('/forex/crm/clients', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await buildForexAdminCrmClientsSnapshotForAdmin(admin.role, request.query);
    return reply.send({ success: true, data });
  });

  app.get<{
    Querystring: {
      q?: string;
      account_status?: string;
      user_status?: string;
      has_open_positions?: string;
      kyc_status?: string;
      risk_level?: string;
    };
  }>('/forex/crm/clients/export', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const csv = await exportForexAdminCrmClientsCsv(admin.role, request.query);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="forex-crm-clients.csv"');
    return reply.send(csv);
  });

  app.get<{ Params: { accountId: string }; Querystring: { limit?: string } }>(
    '/forex/crm/clients/:accountId/activity',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
      if (!admin) return;
      const data = await buildForexAdminCrmClientActivityScoped(
        request.params.accountId,
        admin.role,
        request.query.limit,
      );
      if (!data) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Forex account not found' },
        });
      }
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { accountId: string } }>('/forex/crm/clients/:accountId', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await buildForexAdminCrmClientDetailScoped(request.params.accountId, admin.role);
    if (!data) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Forex account not found' },
      });
    }
    return reply.send({ success: true, data });
  });

  app.get<{
    Querystring: { page?: string; limit?: string; q?: string; account_status?: string };
  }>('/forex/crm/finance/accounts', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const data = await buildForexAdminFinanceAccountsSnapshot(request.query);
    return reply.send({ success: true, data });
  });

  app.get<{
    Querystring: { q?: string; account_status?: string };
  }>('/forex/crm/finance/accounts/export', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const csv = await exportForexAdminFinanceAccountsCsv(request.query);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="forex-crm-finance-accounts.csv"');
    return reply.send(csv);
  });

  app.get<{
    Querystring: { page?: string; limit?: string; account_id?: string; kind?: string; ok?: string };
  }>('/forex/crm/finance/reconciliation/export', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const csv = await exportForexAdminFinanceReconciliationCsv(request.query);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="forex-crm-finance-reconciliation.csv"');
    return reply.send(csv);
  });

  app.get<{
    Querystring: { page?: string; limit?: string; account_id?: string; kind?: string; ok?: string };
  }>('/forex/crm/finance/reconciliation', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const data = await listForexAdminFinanceReconciliation(request.query);
    return reply.send({ success: true, data });
  });

  app.get<{ Params: { accountId: string }; Querystring: { tx_limit?: string } }>(
    '/forex/crm/finance/accounts/:accountId',
    async (request, reply) => {
      const admin = await getAdminFromRequest(app, request, reply, false);
      if (!admin) return;
      const data = await buildForexAdminFinanceAccountDetail(
        request.params.accountId,
        request.query.tx_limit,
      );
      if (!data) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Forex account not found' },
        });
      }
      return reply.send({ success: true, data });
    },
  );

  app.get('/forex/crm/pipeline', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await buildForexCrmSalesPipelineSnapshot();
    return reply.send({ success: true, data });
  });

  app.get<{ Querystring: { from?: string; to?: string } }>('/forex/reporting/snapshot', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:finance:view');
    if (!admin) return;
    try {
      const data = await buildForexAdminReportingSnapshot({ from: request.query.from, to: request.query.to });
      return reply.send({ success: true, data });
    } catch (e) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_RANGE', message: String(e) } });
    }
  });

  app.get('/forex/risk/control-plane', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:risk:view');
    if (!admin) return;
    const data = buildForexAdminRiskControlSnapshot();
    return reply.send({ success: true, data });
  });

  app.get('/forex/holidays', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:view');
    if (!admin) return;
    const data = await listForexHolidayDates();
    return reply.send({ success: true, data });
  });

  app.post<{ Body: { date?: string; kind?: string; notes?: string } }>('/forex/holidays', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    try {
      const row = await upsertForexHolidayDate({
        date: String(request.body?.date ?? ''),
        kind: String(request.body?.kind ?? 'holiday'),
        notes: request.body?.notes,
      });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'forex_holiday_upsert',
        resourceType: 'forex_holiday',
        resourceId: null,
        oldValue: null,
        newValue: row,
      });
      return reply.send({ success: true, data: row });
    } catch (e) {
      return reply.status(400).send({ success: false, error: { code: e instanceof Error ? e.message : 'UPSERT_FAILED', message: 'Holiday upsert failed' } });
    }
  });

  app.delete<{ Params: { date: string } }>('/forex/holidays/:date', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
    if (!admin) return;
    await deleteForexHolidayDate(request.params.date);
    return reply.send({ success: true, data: { deleted: request.params.date } });
  });

  app.get('/forex/partners', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:crm:view');
    if (!admin) return;
    const data = await listForexPartnerProfiles();
    return reply.send({
      success: true,
      data: {
        rows: data.rows.map((r) => ({
          partner_id: r.partner_id,
          code: r.code,
          display_name: r.label,
          status: r.status,
          parent_partner_id: null,
          commission_plan_id: r.commission_plan_code,
          created_at: r.created_at,
        })),
        table_present: data.table_present,
        payouts_connected: data.payouts_connected,
        note: 'Forex IB domain · payouts NOT CONNECTED · separate from Crypto referral',
      },
    });
  });

  app.get<{ Querystring: { page?: string; limit?: string; symbol?: string; account_id?: string } }>(
    '/forex/dealing/queue',
    async (request, reply) => {
      const admin = await getAdminWithPermission(app, request, reply, 'forex:dealing:view');
      if (!admin) return;
      const data = await listForexDealingQueue(request.query);
      return reply.send({ success: true, data });
    },
  );

  app.get('/forex/routing/desk', async (request, reply) => {
    const admin = await getAdminFromRequest(app, request, reply, false);
    if (!admin) return;
    const data = await buildForexAdminRoutingDeskSnapshot();
    return reply.send({ success: true, data });
  });

  app.patch<{
    Params: { providerId: string };
    Body: { reason?: string; enabled?: boolean; priority?: number; failover_enabled?: boolean };
  }>('/forex/execution/routing/:providerId', async (request, reply) => {
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
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
      const { request: approvalReq, correlationId } = await createForexAdminApprovalRequest({
        actionType: 'forex_routing_patch',
        requestedBy: admin.adminId,
        payload: {
          providerId: request.params.providerId,
          ...patch,
          reason,
          executingAdminId: admin.adminId,
        },
      });
      await logAuditFromRequest(request, {
        actorType: 'admin',
        actorId: admin.adminId,
        action: 'admin_approval_request_create',
        resourceType: 'admin_approval_request',
        resourceId: approvalReq.id,
        oldValue: null,
        newValue: { action_type: 'forex_routing_patch', providerId: request.params.providerId, correlationId },
      });
      return reply.status(202).send({
        success: true,
        data: {
          approval_required: true,
          approval_id: approvalReq.id,
          snapshot: await buildForexAdminExecutionSnapshot(),
        },
      });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'ROUTING_UPDATE_FAILED';
      return reply.status(400).send({
        success: false,
        error: { code, message: 'Routing update failed.' },
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
    const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
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
      const admin = await getAdminWithPermission(app, request, reply, 'forex:controls:manage');
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
