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
}
