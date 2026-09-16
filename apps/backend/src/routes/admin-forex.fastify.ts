/**
 * Admin Forex FDM — read-only ops (F1). Mounted at /api/v1/admin.
 * Admin JWT required. Does not mutate forex policy or customer state.
 */
import type { FastifyInstance } from 'fastify';
import { getAdminFromRequest } from './admin.fastify.js';
import { getForexAdminBackendConfig } from '../services/forex/admin/config.js';
import { loadForexAdminOverviewCounts } from '../services/forex/admin/overview.js';
import { forexConfig } from '../services/forex/config.js';
import { forexReadinessSnapshot } from '../services/forex/durability/ready.js';
import { forexMarketDataWorkerSnapshot } from '../services/forex/market-data/worker.js';
import { listForexSymbols } from '../services/forex/instruments.catalog.js';

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
          killSwitch: forexConfig.killSwitch,
          demoFundingEnabled: forexConfig.demoFundingEnabled,
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
          killSwitch: forexConfig.killSwitch,
          fundingTestApiEnabled: forexConfig.fundingTestApiEnabled,
          demoFundingEnabled: forexConfig.demoFundingEnabled,
          executionTestApiEnabled: forexConfig.executionTestApiEnabled,
        },
      },
    });
  });
}
